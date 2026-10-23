import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UUIDToBuffer } from "../../helper/UUIDToBuffer.js";
import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { createSchoolFixture, RUN_ID } from "../helpers/fixtures.js";
import type { TestClass, TestFaculty, TestPeriod, TestSchool, TestStudent, TestSubject } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let school: TestSchool;
let anotherSchool: TestSchool;

// Attendance cannot be recorded on a date before the class row was created, and
// the class rows are inserted "now" by the fixture. Backdate them so the tests
// can use real past dates.
const CLASS_CREATED_AT = "2020-01-01 00:00:00";
const PERIOD_START = "2024-01-01";
const PERIOD_END = "2030-12-31";

const pad = (value: number): string => String(value).padStart(2, "0");
const isoDate = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

let attendanceOffset = 0;
/**
 * A unique past date per test. School-wide attendance endpoints are scoped by
 * the shared `school` fixture, so each test must use its own date to keep the
 * expected row counts deterministic.
 */
const nextAttendanceDate = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - ++attendanceOffset);
    return isoDate(date);
};

let buildCounter = 0;
const uniqueName = (prefix: string): string => `${prefix} ${RUN_ID}-${++buildCounter}`;

const countRows = async (sql: string, params: (string | number | Buffer)[] = []): Promise<number> => {
    const [rows] = await connection!.execute(sql, params);
    const row = (rows as { cnt: number }[])[0];
    return Number(row?.cnt ?? 0);
};

const ENROLLED_WEIGHTS = [
    { category: "activities", weight: 20 },
    { category: "quizzes", weight: 30 },
    { category: "exams", weight: 40 },
    { category: "attendance", weight: 10 },
];

type ClassSetup = {
    classroom: TestClass;
    teacher: TestFaculty;
    period: TestPeriod;
};

type EnrolledClassSetup = ClassSetup & {
    student: TestStudent;
    subject: TestSubject;
};

type PlainClassSetup = ClassSetup & {
    subject: TestSubject;
};

const createClass = async (
    school_: TestSchool,
    teacher: TestFaculty
): Promise<{ classroom: TestClass; period: TestPeriod }> => {
    const classroom = await school_.addClass({ adviserId: teacher.id });
    await school_.run("UPDATE classes SET created_at = ? WHERE id = ?", [
        CLASS_CREATED_AT,
        UUIDToBuffer(classroom.id),
    ]);
    const period = await school_.addPeriod(classroom.schoolYearId, {
        name: uniqueName("Period"),
        isCurrent: true,
        startDate: PERIOD_START,
        endDate: PERIOD_END,
    });
    return { classroom, period };
};

const buildClass = async (
    school_: TestSchool,
    teacher: TestFaculty,
    subject: TestSubject
): Promise<PlainClassSetup> => {
    const { classroom, period } = await createClass(school_, teacher);
    await school_.assignFacultyToClass(classroom, teacher, subject);
    return { classroom, teacher, subject, period };
};

const buildEnrolledClass = async (
    school_: TestSchool,
    teacher: TestFaculty,
    subject: TestSubject,
    student: TestStudent
): Promise<EnrolledClassSetup> => {
    const { classroom, period } = await createClass(school_, teacher);
    await school_.assignFacultyToClass(classroom, teacher, subject);
    await school_.enroll(student, classroom, [subject]);
    return { classroom, teacher, student, subject, period };
};

const markAttendance = (
    teacher: TestFaculty,
    classroom: TestClass,
    subject: TestSubject,
    student: TestStudent,
    date: string,
    status: "present" | "absent" = "present"
) =>
    api
        .post(teacher.identity, `/api/attendance/class/${classroom.id}`)
        .send({
            subject_id: subject.id,
            records: [{ student_id: student.id, status }],
            date,
        });

describe("gradebook and attendance endpoint behavior", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        school = await createSchoolFixture(connection);
        anotherSchool = await createSchoolFixture(connection, { name: `Other ${RUN_ID}` });
    });

    afterAll(async () => {
        if (!connection) return;
        try {
            await cleanupTestData(connection, {
                schoolIds: [school.schoolId, anotherSchool.schoolId],
            });
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    // --- Grading weights ---

    it("allows a teacher to set grading weights and read them back", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);

        const putRes = await api
            .put(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
            .send({ weights: ENROLLED_WEIGHTS });
        const putOut = expectSuccess(putRes, 200);
        expect(putOut.message).toBe("Grading weights updated successfully");

        const getRes = await api.get(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`);
        const getOut = expectSuccess(getRes, 200);
        expect(
            getOut.data.map((w: { category: string; weight: number }) => [w.category, w.weight])
        ).toEqual(ENROLLED_WEIGHTS.map((w) => [w.category, w.weight]));
    });

    it("rejects weights that do not total 100", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);

        expectError(
            await api
                .put(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
                .send({ weights: [{ category: "activities", weight: 10 }] }),
            400,
            "Exactly 4 category weights are required"
        );
    });

    it("returns an empty weight list before any weights are set", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);

        const res = expectSuccess(
            await api.get(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`),
            200
        );
        expect(res.data).toEqual([]);
    });

    it("rejects invalid weight categories, values and totals", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);
        const url = `/api/gradebook/weights/${classroom.id}/${subject.id}`;

        expectError(
            await api
                .put(teacher.identity, url)
                .send({
                    weights: [
                        { category: "homework", weight: 40 },
                        { category: "quizzes", weight: 20 },
                        { category: "exams", weight: 20 },
                        { category: "attendance", weight: 20 },
                    ],
                }),
            400,
            "Invalid category: homework"
        );
        expectError(
            await api
                .put(teacher.identity, url)
                .send({
                    weights: [
                        { category: "activities", weight: 150 },
                        { category: "quizzes", weight: 0 },
                        { category: "exams", weight: 0 },
                        { category: "attendance", weight: 0 },
                    ],
                }),
            400,
            "Weight must be between 0 and 100"
        );
        expectError(
            await api
                .put(teacher.identity, url)
                .send({
                    weights: [
                        { category: "activities", weight: 20 },
                        { category: "quizzes", weight: 20 },
                        { category: "exams", weight: 20 },
                        { category: "attendance", weight: 20 },
                    ],
                }),
            400,
            "must total exactly 100%. Current total: 80%"
        );
    });

    it("denies a teacher from updating weights for a class they do not teach", async () => {
        const teacherA = await school.addFaculty();
        const teacherB = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacherA, subject);

        expectError(
            await api
                .put(teacherB.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
                .send({ weights: ENROLLED_WEIGHTS }),
            403,
            "not assigned to teach"
        );
    });

    it("blocks weight changes once grades are finalized", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        await api
            .post(teacher.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id });

        expectError(
            await api
                .put(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
                .send({ weights: ENROLLED_WEIGHTS }),
            400,
            "Cannot change grading weights"
        );
    });

    it("allows a student to read weights but not change them", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);
        await school.enroll(student, classroom, [subject]);

        const getRes = await api.get(student.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`);
        expectSuccess(getRes, 200);

        expectError(
            await api
                .put(student.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
                .send({ weights: ENROLLED_WEIGHTS }),
            403,
            "Insufficient"
        );
    });

    it("denies reading gradebook data for a class in another school", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const teacherOther = await anotherSchool.addFaculty();
        const studentOther = await anotherSchool.addStudent();
        const subjectOther = await anotherSchool.addSubject();
        const { classroom } = await buildEnrolledClass(
            anotherSchool,
            teacherOther,
            subjectOther,
            studentOther
        );
        const weightsUrl = `/api/gradebook/weights/${classroom.id}/${subjectOther.id}`;
        const itemsUrl = `/api/gradebook/items/${classroom.id}/${subjectOther.id}`;
        const gradesUrl = `/api/gradebook/grades/${classroom.id}/${subjectOther.id}`;

        expectError(await api.get(teacher.identity, weightsUrl), 403, "cross-school violation");
        expectError(await api.get(teacher.identity, itemsUrl), 403, "cross-school violation");
        expectError(await api.get(teacher.identity, gradesUrl), 403, "cross-school violation");
        expectError(await api.get(student.identity, weightsUrl), 403, "cross-school violation");
        expectError(await api.get(student.identity, itemsUrl), 403, "cross-school violation");
    });

    it("returns 404 when reading gradebook data for an unknown class", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const unknownClass = "00000000-0000-4000-8000-000000000000";

        expectError(
            await api.get(teacher.identity, `/api/gradebook/weights/${unknownClass}/${subject.id}`),
            404,
            "Class not found"
        );
        expectError(
            await api.get(teacher.identity, `/api/gradebook/items/${unknownClass}/${subject.id}`),
            404,
            "Class not found"
        );
    });

    // --- Grade items ---

    it("creates, updates, reads and deletes a grade item", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom, period } = await buildClass(school, teacher, subject);

        const created = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 25,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        const itemId = created.data.id as string;

        const updated = await api
            .put(teacher.identity, `/api/gradebook/items/${itemId}`)
            .send({
                title: `Quiz ${RUN_ID} edited`,
                category: "quizzes",
                max_score: 30,
                due_date: "2025-03-11",
                period_id: period.id,
            });
        expectSuccess(updated, 200);

        const fetched = expectSuccess(
            await api.get(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`),
            200
        );
        const item = fetched.data.find((i: { id: string }) => i.id === itemId);
        expect(item).toMatchObject({
            category: "quizzes",
            title: `Quiz ${RUN_ID} edited`,
            max_score: 30,
            period_id: period.id,
            faculty_id: teacher.id,
        });
        // MySQL returns DATE columns as timestamps; compare the date portion.
        expect(String(item.due_date).slice(0, 10)).toBe("2025-03-11");

        expectSuccess(await api.delete(teacher.identity, `/api/gradebook/items/${itemId}`), 200);
        const after = expectSuccess(
            await api.get(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`),
            200
        );
        expect(after.data.find((i: { id: string }) => i.id === itemId)).toBeUndefined();
    });

    it("rejects a grade item created for a period outside the class school year", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);

        const otherYear = await school.addSchoolYear({ name: uniqueName("Other year") });
        const otherPeriod = await school.addPeriod(otherYear.id, {
            name: uniqueName("Other period"),
            startDate: "2024-01-01",
            endDate: "2024-03-31",
        });

        expectError(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: otherPeriod.id,
                }),
            400,
            "Academic period does not belong to this class's school year"
        );
    });

    it("validates grade item fields", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom, period } = await buildClass(school, teacher, subject);
        const url = `/api/gradebook/items/${classroom.id}/${subject.id}`;

        expectError(
            await api.post(teacher.identity, url).send({
                category: "attendance",
                title: `Task ${RUN_ID}`,
                max_score: 10,
                due_date: "2025-03-10",
                period_id: period.id,
            }),
            400,
            "Invalid category"
        );
        expectError(
            await api.post(teacher.identity, url).send({
                category: "activities",
                title: "   ",
                max_score: 10,
                due_date: "2025-03-10",
                period_id: period.id,
            }),
            400,
            "Title is required"
        );
        expectError(
            await api.post(teacher.identity, url).send({
                category: "activities",
                title: `Task ${RUN_ID}`,
                max_score: 0,
                due_date: "2025-03-10",
                period_id: period.id,
            }),
            400,
            "max_score must be greater than 0"
        );
        expectError(
            await api.post(teacher.identity, url).send({
                category: "activities",
                title: `Task ${RUN_ID}`,
                max_score: 10,
                due_date: "10-03-2025",
                period_id: period.id,
            }),
            400,
            "due_date must be in YYYY-MM-DD format"
        );
        expectError(
            await api.post(teacher.identity, url).send({
                category: "activities",
                title: `Task ${RUN_ID}`,
                max_score: 10,
                due_date: "2025-03-10",
            }),
            400,
            "Academic period is required"
        );
    });

    it("denies another teacher from updating or deleting a grade item", async () => {
        const teacherA = await school.addFaculty();
        const teacherB = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom, period } = await buildClass(school, teacherA, subject);

        const item = expectSuccess(
            await api
                .post(teacherA.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        const itemId = item.data.id as string;

        expectError(
            await api.put(teacherB.identity, `/api/gradebook/items/${itemId}`).send({
                title: `Task ${RUN_ID} edited`,
                category: "activities",
                max_score: 10,
                due_date: "2025-03-10",
                period_id: period.id,
            }),
            403,
            "permission"
        );
        expectError(
            await api.delete(teacherB.identity, `/api/gradebook/items/${itemId}`),
            403,
            "permission"
        );
    });

    it("blocks grade item create, update and delete after finalization", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        const itemId = item.data.id as string;

        await api
            .post(teacher.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id });

        expectError(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "quizzes",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            400,
            "finalized"
        );
        expectError(
            await api.put(teacher.identity, `/api/gradebook/items/${itemId}`).send({
                title: `Task ${RUN_ID} edited`,
                category: "activities",
                max_score: 10,
                due_date: "2025-03-10",
                period_id: period.id,
            }),
            400,
            "finalized"
        );
        expectError(
            await api.delete(teacher.identity, `/api/gradebook/items/${itemId}`),
            400,
            "finalized"
        );
    });

    it("deleting a grade item cascades its scores", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        const itemId = item.data.id as string;

        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${itemId}`)
                .send({ grades: [{ student_id: student.id, score: 9 }] }),
            200
        );
        expect(
            await countRows("SELECT COUNT(*) AS cnt FROM grades WHERE grade_item_id = ?", [
                UUIDToBuffer(itemId),
            ])
        ).toBe(1);

        expectSuccess(await api.delete(teacher.identity, `/api/gradebook/items/${itemId}`), 200);
        expect(
            await countRows("SELECT COUNT(*) AS cnt FROM grades WHERE grade_item_id = ?", [
                UUIDToBuffer(itemId),
            ])
        ).toBe(0);
    });

    it("allows a student to read grade items but not create or update them", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildClass(school, teacher, subject);
        await school.enroll(student, classroom, [subject]);

        const created = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );

        const read = expectSuccess(
            await api.get(student.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`),
            200
        );
        expect(read.data).toHaveLength(1);
        expect(read.data[0].id).toBe(created.data.id);

        const itemId = created.data.id as string;
        expectError(
            await api
                .post(student.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            403,
            "Insufficient"
        );
        expectError(
            await api
                .put(student.identity, `/api/gradebook/items/${itemId}`)
                .send({
                    title: `Quiz ${RUN_ID}`,
                    category: "activities",
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            403,
            "Insufficient"
        );
    });

    // --- Grades ---

    it("lets a teacher record scores and read them back", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "quizzes",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );

        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: student.id, score: 18 }] }),
            200
        );

        const view = expectSuccess(
            await api.get(teacher.identity, `/api/gradebook/grades/${classroom.id}/${subject.id}`),
            200
        );
        const row = view.data.students.find((s: { student_id: string }) => s.student_id === student.id);
        expect(row).toBeDefined();
        const itemRow = row.items.find((i: { id: string }) => i.id === item.data.id);
        expect(itemRow).toMatchObject({ score: 18, max_score: 20 });
    });

    it("allows a student to see their own grades for the subject", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: student.id, score: 7 }] }),
            200
        );

        const studentView = expectSuccess(
            await api.get(student.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        expect(studentView.data).toMatchObject({
            activities: {
                items: expect.arrayContaining([
                    expect.objectContaining({ title: `Task ${RUN_ID}`, score: 7, max_score: 10 }),
                ]),
            },
        });
    });

    it("attaches an activity created from a teaching module to the enrolled student's grades and summary", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        // 1. Teacher creates a module for this subject
        const moduleRes = expectSuccess(
            await api
                .post(teacher.identity, "/api/modules/mine")
                .send({
                    title: `Module for Grades ${RUN_ID}`,
                    description: "Module with activity template",
                    subject_id: subject.id,
                    status: "draft",
                }),
            201
        );
        const moduleId = moduleRes.data.id;

        // 2. Teacher adds an activity template to the module
        const templateRes = expectSuccess(
            await api
                .post(teacher.identity, `/api/modules/mine/${moduleId}/templates`)
                .send({
                    title: `Module Activity Template ${RUN_ID}`,
                    instructions: "Complete all questions",
                    category: "activities",
                    max_score: 25,
                    sort_order: 0,
                }),
            201
        );
        const templateId = templateRes.data.id;

        // 3. Teacher assigns the module to the classroom
        const assignmentRes = expectSuccess(
            await api
                .post(teacher.identity, "/api/class-modules")
                .send({
                    module_id: moduleId,
                    classroom_id: classroom.id,
                    school_year_id: classroom.schoolYearId,
                }),
            201
        );
        const assignmentId = assignmentRes.data.id;

        // 4. Teacher instantiates an activity in the classroom from the module template
        const activityTitle = `Assigned Module Activity ${RUN_ID}`;
        const instantiatedRes = expectSuccess(
            await api
                .post(teacher.identity, `/api/class-modules/${assignmentId}/activities`)
                .send({
                    template_id: templateId,
                    period_id: period.id,
                    title: activityTitle,
                    max_score: 25,
                    due_date: "2025-03-15",
                }),
            201
        );
        const activityId = instantiatedRes.data.id;

        // 5. Verify the created activity is attached to the enrolled student's subject grades
        const studentSubjectGrades = expectSuccess(
            await api.get(student.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        expect(studentSubjectGrades.data.activities.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: activityId,
                    title: activityTitle,
                    max_score: 25,
                    score: null,
                    due_date: "2025-03-15",
                }),
            ])
        );

        // 6. Verify the created activity is attached to the student's overall gradebook summary
        const studentSummary = expectSuccess(
            await api.get(student.identity, "/api/gradebook/student-summary"),
            200
        );
        const subjectSummary = studentSummary.data.find((s: { class_id: string; subject_id: string }) =>
            s.class_id === classroom.id && s.subject_id === subject.id
        );
        expect(subjectSummary).toBeDefined();
        expect(subjectSummary.activities.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: activityId,
                    title: activityTitle,
                    max_score: 25,
                    score: null,
                }),
            ])
        );

        // 7. Teacher scores the student on the module activity
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${activityId}`)
                .send({ grades: [{ student_id: student.id, score: 23 }] }),
            200
        );

        // 8. The updated score is attached and reflected in the student's grades
        const updatedStudentGrades = expectSuccess(
            await api.get(student.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        expect(updatedStudentGrades.data.activities.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: activityId,
                    title: activityTitle,
                    score: 23,
                    max_score: 25,
                }),
            ])
        );
    });

    it("does not expose another student's scores or grades", async () => {
        const teacher = await school.addFaculty();
        const studentA = await school.addStudent();
        const studentB = await school.addStudent();
        const outsider = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, studentA);
        await school.enroll(studentB, classroom, [subject]);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: studentA.id, score: 7 }] }),
            200
        );

        const viewA = expectSuccess(
            await api.get(studentA.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        expect(
            viewA.data.activities.items.find((i: { id: string }) => i.id === item.data.id)
        ).toMatchObject({ score: 7 });

        const viewB = expectSuccess(
            await api.get(studentB.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        expect(
            viewB.data.activities.items.find((i: { id: string }) => i.id === item.data.id)
        ).toMatchObject({ score: null });

        expectError(
            await api.get(outsider.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            403,
            "not enrolled"
        );
    });

    it("denies a teacher from recording scores on another teacher's item", async () => {
        const teacherA = await school.addFaculty();
        const teacherB = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacherA, subject, student);

        const item = expectSuccess(
            await api
                .post(teacherA.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );

        expectError(
            await api
                .post(teacherB.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: student.id, score: 5 }] }),
            403,
            "permission"
        );
    });

    it("rejects out-of-range scores and unenrolled students", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const unenrolled = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        const gradesUrl = `/api/gradebook/grades/${item.data.id}`;

        expectError(
            await api.post(teacher.identity, gradesUrl).send({
                grades: [{ student_id: student.id, score: -1 }],
            }),
            400,
            "Score must be >= 0"
        );
        expectError(
            await api.post(teacher.identity, gradesUrl).send({
                grades: [{ student_id: student.id, score: 21 }],
            }),
            400,
            "cannot exceed max_score"
        );
        expectError(
            await api.post(teacher.identity, gradesUrl).send({
                grades: [{ student_id: unenrolled.id, score: 10 }],
            }),
            400,
            "not enrolled in this class"
        );
    });

    it("updates an existing score instead of duplicating it", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "quizzes",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );

        await api
            .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
            .send({ grades: [{ student_id: student.id, score: 18 }] });
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: student.id, score: 19 }] }),
            200
        );

        const view = expectSuccess(
            await api.get(teacher.identity, `/api/gradebook/grades/${classroom.id}/${subject.id}`),
            200
        );
        const row = view.data.students.find((s: { student_id: string }) => s.student_id === student.id);
        expect(row.items.find((i: { id: string }) => i.id === item.data.id)).toMatchObject({ score: 19 });
        expect(
            await countRows("SELECT COUNT(*) AS cnt FROM grades WHERE grade_item_id = ?", [
                UUIDToBuffer(item.data.id as string),
            ])
        ).toBe(1);
    });

    it("computes student final grades when weights include attendance", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        expectSuccess(
            await api
                .put(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
                .send({
                    weights: [
                        { category: "activities", weight: 40 },
                        { category: "quizzes", weight: 30 },
                        { category: "exams", weight: 20 },
                        { category: "attendance", weight: 10 },
                    ],
                }),
            200
        );

        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "quizzes",
                    title: `Quiz ${RUN_ID}`,
                    max_score: 20,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );

        const studentView = expectSuccess(
            await api.get(student.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        // Before any scores or attendance, averages and final grade should be null/0.
        expect(studentView.data.activities.average).toBeNull();
        expect(studentView.data.quizzes.average).toBeNull();
        expect(studentView.data.final_grade).toBeNull();
    });

    // --- Finalization ---

    it("allows a teacher to finalize a class subject for a period", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const finalizeRes = await api
            .post(teacher.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id });
        const out = expectSuccess(finalizeRes, 200);
        expect(out.message).toBe("Period grades finalized successfully");

        const listRes = await api
            .get(teacher.identity, `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`);
        const listOut = expectSuccess(listRes, 200);
        expect(listOut.data).toHaveLength(1);
        expect(listOut.data[0]).toMatchObject({
            period_id: period.id,
            student_id: student.id,
        });
    });

    it("allows a school admin to correct a finalization", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        await api
            .post(teacher.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id });

        const listRes = await api
            .get(school.admin.identity, `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`);
        const listOut = expectSuccess(listRes, 200);
        const finalized = listOut.data[0];

        expectSuccess(
            await api
                .put(school.admin.identity, `/api/gradebook/finalizations/${finalized.id}`)
                .send({ final_grade: 88, reason: "Recomputed" }),
            200
        );

        const corrected = expectSuccess(
            await api
                .get(school.admin.identity, `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`),
            200
        );
        expect(corrected.data[0].final_grade).toBe(88);
        expect(corrected.data[0].correction_reason).toBe("Recomputed");
    });

    it("denies a teacher from correcting a finalization", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        await api
            .post(teacher.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id });

        const listRes = await api
            .get(school.admin.identity, `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`);
        const finalized = expectSuccess(listRes, 200).data[0];

        expectError(
            await api
                .put(teacher.identity, `/api/gradebook/finalizations/${finalized.id}`)
                .send({ final_grade: 90, reason: "Adjusted" }),
            403,
            "Insufficient"
        );
    });

    it("allows a school admin to finalize a class subject for a period", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        expectSuccess(
            await api
                .post(school.admin.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id }),
            200
        );
    });

    it("denies a school admin from finalizing a class subject belonging to another school", async () => {
        const teacherOther = await anotherSchool.addFaculty();
        const studentOther = await anotherSchool.addStudent();
        const subjectOther = await anotherSchool.addSubject();
        const { classroom, period } = await buildEnrolledClass(
            anotherSchool,
            teacherOther,
            subjectOther,
            studentOther
        );

        expectError(
            await api
                .post(school.admin.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subjectOther.id, period_id: period.id }),
            404,
            "not available"
        );
    });

    it("denies a teacher from finalizing a class subject they do not teach", async () => {
        const teacherA = await school.addFaculty();
        const teacherB = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacherA, subject, student);

        expectError(
            await api
                .post(teacherB.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id }),
            403,
            "not assigned to teach"
        );
    });

    it("computes the weighted final grade and the student summary agrees", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        expectSuccess(
            await api
                .put(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`)
                .send({
                    weights: [
                        { category: "activities", weight: 40 },
                        { category: "quizzes", weight: 30 },
                        { category: "exams", weight: 20 },
                        { category: "attendance", weight: 10 },
                    ],
                }),
            200
        );

        const createItem = async (category: string, title: string, maxScore: number) => {
            const created = expectSuccess(
                await api
                    .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                    .send({
                        category,
                        title,
                        max_score: maxScore,
                        due_date: "2025-03-10",
                        period_id: period.id,
                    }),
                201
            );
            return created.data.id as string;
        };

        const activity1 = await createItem("activities", `Task 1 ${RUN_ID}`, 10);
        const activity2 = await createItem("activities", `Task 2 ${RUN_ID}`, 10);
        const quiz = await createItem("quizzes", `Quiz ${RUN_ID}`, 20);

        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${activity1}`)
                .send({ grades: [{ student_id: student.id, score: 8 }] }),
            200
        );
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${activity2}`)
                .send({ grades: [{ student_id: student.id, score: 9 }] }),
            200
        );
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${quiz}`)
                .send({ grades: [{ student_id: student.id, score: 18 }] }),
            200
        );
        expectSuccess(
            await markAttendance(teacher, classroom, subject, student, nextAttendanceDate()),
            200
        );

        expectSuccess(
            await api
                .post(teacher.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id }),
            200
        );

        // activities 85 (17/20), quizzes 90 (18/20), exams excluded (no items),
        // attendance 100. Active weights 40 + 30 + 10 = 80 => 88.75.
        const list = expectSuccess(
            await api.get(
                teacher.identity,
                `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );
        expect(list.data).toHaveLength(1);
        expect(list.data[0].final_grade).toBe(88.75);

        const summary = expectSuccess(
            await api.get(student.identity, `/api/gradebook/student/${classroom.id}/${subject.id}`),
            200
        );
        expect(summary.data.activities.average).toBe(85);
        expect(summary.data.quizzes.average).toBe(90);
        expect(summary.data.final_grade).toBe(88.75);
    });

    it("finalizes year-end grades when no period is given", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        const out = expectSuccess(
            await api
                .post(teacher.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id }),
            200
        );
        expect(out.message).toBe("Year-end grades finalized successfully");

        const list = expectSuccess(
            await api.get(
                teacher.identity,
                `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );
        expect(list.data).toHaveLength(1);
        expect(list.data[0].period_id).toBeNull();
    });

    it("rejects finalization when the class has no enrolled students", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom, period } = await buildClass(school, teacher, subject);

        expectError(
            await api
                .post(teacher.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id }),
            400,
            "No enrolled students"
        );
    });

    it("rejects invalid, foreign-school and unauthorized finalization requests", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        expectError(
            await api
                .post(teacher.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: 0 }),
            400,
            "Invalid period_id"
        );

        const otherPeriod = await anotherSchool.addPeriod(anotherSchool.currentSchoolYear.id, {
            name: uniqueName("Other period"),
            startDate: PERIOD_START,
            endDate: PERIOD_END,
        });
        expectError(
            await api
                .post(teacher.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: otherPeriod.id }),
            400,
            "does not belong to this school"
        );

        expectError(
            await api
                .post(student.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id }),
            403,
            "Insufficient"
        );
    });

    it("re-finalizing updates the existing rows instead of duplicating them", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);
        const body = { class_id: classroom.id, subject_id: subject.id, period_id: period.id };

        expectSuccess(await api.post(teacher.identity, "/api/gradebook/finalize").send(body), 200);
        const first = expectSuccess(
            await api.get(
                teacher.identity,
                `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );

        expectSuccess(await api.post(teacher.identity, "/api/gradebook/finalize").send(body), 200);
        const second = expectSuccess(
            await api.get(
                teacher.identity,
                `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );

        expect(second.data).toHaveLength(1);
        expect(second.data[0].id).toBe(first.data[0].id);
    });

    it("validates finalization corrections", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        await api
            .post(teacher.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id });

        const list = expectSuccess(
            await api.get(
                school.admin.identity,
                `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );
        const finalizationId = list.data[0].id;

        expectError(
            await api
                .put(school.admin.identity, `/api/gradebook/finalizations/${finalizationId}`)
                .send({ final_grade: 120, reason: "Over" }),
            400,
            "between 0 and 100"
        );
        expectError(
            await api
                .put(school.admin.identity, `/api/gradebook/finalizations/${finalizationId}`)
                .send({ final_grade: 90, reason: "   " }),
            400,
            "reason is required"
        );
    });

    // --- Student summary ---

    it("returns a student's summary across enrolled subjects", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: student.id, score: 8 }] }),
            200
        );

        const summary = expectSuccess(
            await api.get(student.identity, "/api/gradebook/student-summary"),
            200
        );
        expect(summary.data).toHaveLength(1);
        expect(summary.data[0]).toMatchObject({
            subject_id: subject.id,
            subject_name: subject.name,
            class_id: classroom.id,
            class_name: classroom.name,
            activities: {
                items: expect.arrayContaining([
                    expect.objectContaining({ title: `Task ${RUN_ID}`, score: 8, max_score: 10 }),
                ]),
            },
        });
    });

    it("denies a teacher from reading another user's student summary", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        await buildEnrolledClass(school, teacher, subject, student);

        expectError(await api.get(teacher.identity, "/api/gradebook/student-summary"), 403, "Insufficient");
    });

    // --- Attendance: marking and sessions ---

    it("allows a teacher to mark and edit attendance for their class subject", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const attendanceDate = nextAttendanceDate();

        expectSuccess(await markAttendance(teacher, classroom, subject, student, attendanceDate), 200);

        const view = expectSuccess(
            await api.get(teacher.identity, `/api/attendance/class/${classroom.id}?date=${attendanceDate}`),
            200
        );
        expect(view.data).toHaveLength(1);
        expect(view.data[0]).toMatchObject({
            student_id: student.id,
            subject_id: subject.id,
            status: "present",
        });

        expectSuccess(
            await api
                .put(teacher.identity, `/api/attendance/class/${classroom.id}`)
                .send({
                    subject_id: subject.id,
                    records: [{ student_id: student.id, status: "absent" }],
                    date: attendanceDate,
                }),
            200
        );

        const updated = expectSuccess(
            await api.get(teacher.identity, `/api/attendance/class/${classroom.id}?date=${attendanceDate}`),
            200
        );
        expect(updated.data[0]).toMatchObject({ status: "absent" });
    });

    it("denies a teacher from marking attendance for a subject they do not teach", async () => {
        const teacherA = await school.addFaculty();
        const teacherB = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacherA, subject, student);

        expectError(
            await markAttendance(teacherB, classroom, subject, student, nextAttendanceDate()),
            403,
            "not assigned to teach"
        );
    });

    it("denies a teacher from marking attendance for a student from another school", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const otherStudent = await anotherSchool.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        expectError(
            await markAttendance(teacher, classroom, subject, otherStudent, nextAttendanceDate()),
            400,
            "not enrolled"
        );
    });

    it("denies a teacher from marking attendance for a future date", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);

        expectError(
            await markAttendance(teacher, classroom, subject, student, isoDate(future)),
            400,
            "Cannot mark attendance for a future date"
        );
    });

    it("denies a teacher from marking attendance for a class that has no current school year", async () => {
        const teacher = await anotherSchool.addFaculty();
        const student = await anotherSchool.addStudent();
        const subject = await anotherSchool.addSubject();
        const { classroom } = await buildEnrolledClass(anotherSchool, teacher, subject, student);

        await anotherSchool.run("UPDATE school_years SET is_current = 0 WHERE school_id = ?", [
            anotherSchool.schoolId,
        ]);
        try {
            expectError(
                await markAttendance(teacher, classroom, subject, student, nextAttendanceDate()),
                400,
                "No current school year is set for this school"
            );
        } finally {
            await anotherSchool.run("UPDATE school_years SET is_current = 1 WHERE id = ?", [
                anotherSchool.currentSchoolYear.id,
            ]);
        }
    });

    it("validates attendance marking payloads", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const url = `/api/attendance/class/${classroom.id}`;
        const records = [{ student_id: student.id, status: "present" }];

        expectError(
            await api.post(teacher.identity, url).send({ records, date: nextAttendanceDate() }),
            400,
            "subject_id is required"
        );
        expectError(
            await api.post(teacher.identity, url).send({ subject_id: subject.id, records: [] }),
            400,
            "No attendance records provided"
        );
        expectError(
            await api
                .post(teacher.identity, url)
                .send({ subject_id: subject.id, records, date: "10-03-2025" }),
            400,
            "date must be in YYYY-MM-DD format"
        );
        expectError(
            await api
                .post(teacher.identity, url)
                .send({
                    subject_id: subject.id,
                    records: [{ student_id: student.id, status: "late" }],
                    date: nextAttendanceDate(),
                }),
            400,
            "Each record requires"
        );
        expectError(
            await api
                .post(teacher.identity, "/api/attendance/class/00000000-0000-4000-8000-000000000000")
                .send({ subject_id: subject.id, records, date: nextAttendanceDate() }),
            404,
            "Class not found"
        );
    });

    it("rejects duplicate and pre-class attendance dates", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        expectSuccess(await markAttendance(teacher, classroom, subject, student, date), 200);
        expectError(
            await markAttendance(teacher, classroom, subject, student, date),
            400,
            "already exists"
        );
        expectError(
            await markAttendance(teacher, classroom, subject, student, "2019-05-05"),
            400,
            "Date is before the class was created"
        );
    });

    it("allows a teacher to create an attendance session inside a valid period", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        const created = expectSuccess(
            await api
                .post(teacher.identity, "/api/attendance/sessions")
                .send({ class_id: classroom.id, subject_id: subject.id, date, period_id: period.id }),
            201
        );
        expect(created.message).toBe("Attendance session created successfully");
        expect(created.data).toMatchObject({
            date,
            subject_id: subject.id,
            period_id: period.id,
        });

        const sessions = expectSuccess(
            await api.get(teacher.identity, `/api/attendance/sessions/${classroom.id}`),
            200
        );
        expect(sessions.data).toHaveLength(1);
        expect(sessions.data[0]).toMatchObject({
            class_id: classroom.id,
            subject_id: subject.id,
            attendance_date: date,
            period_id: period.id,
            period_name: period.name,
            created_by: teacher.id,
        });
    });

    it("denies a teacher from creating a session for a date outside the selected period", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        const closedPeriod = await school.addPeriod(classroom.schoolYearId, {
            name: uniqueName("Closed period"),
            startDate: "2021-01-01",
            endDate: "2021-02-01",
        });

        expectError(
            await api
                .post(teacher.identity, "/api/attendance/sessions")
                .send({
                    class_id: classroom.id,
                    subject_id: subject.id,
                    date: nextAttendanceDate(),
                    period_id: closedPeriod.id,
                }),
            400,
            "date must fall within the selected academic period"
        );
    });

    it("denies a teacher from creating a session for a period belonging to another school", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);

        const otherPeriod = await anotherSchool.addPeriod(anotherSchool.currentSchoolYear.id, {
            name: uniqueName("Other period"),
            isCurrent: true,
            startDate: PERIOD_START,
            endDate: PERIOD_END,
        });

        expectError(
            await api
                .post(teacher.identity, "/api/attendance/sessions")
                .send({
                    class_id: classroom.id,
                    subject_id: subject.id,
                    date: nextAttendanceDate(),
                    period_id: otherPeriod.id,
                }),
            400,
            "Academic period does not belong to this school"
        );
    });

    it("rejects sessions without a period, duplicates and future dates", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();
        const body = { class_id: classroom.id, subject_id: subject.id, date };

        expectError(
            await api.post(teacher.identity, "/api/attendance/sessions").send(body),
            400,
            "Academic period is required"
        );
        expectSuccess(
            await api
                .post(teacher.identity, "/api/attendance/sessions")
                .send({ ...body, period_id: period.id }),
            201
        );
        expectError(
            await api
                .post(teacher.identity, "/api/attendance/sessions")
                .send({ ...body, period_id: period.id }),
            400,
            "already exists"
        );

        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        expectError(
            await api
                .post(teacher.identity, "/api/attendance/sessions")
                .send({ ...body, date: isoDate(future), period_id: period.id }),
            400,
            "future date"
        );
    });

    it("denies listing sessions for a class the teacher is not assigned to", async () => {
        const teacher = await school.addFaculty();
        const teacherOther = await anotherSchool.addFaculty();
        const studentOther = await anotherSchool.addStudent();
        const subjectOther = await anotherSchool.addSubject();
        const { classroom } = await buildEnrolledClass(
            anotherSchool,
            teacherOther,
            subjectOther,
            studentOther
        );

        expectError(
            await api.get(teacher.identity, `/api/attendance/sessions/${classroom.id}`),
            403,
            "not assigned to this class"
        );
    });

    // --- Attendance: views, history, reports ---

    it("allows a teacher to view attendance for their class on a given date", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, date);

        const view = expectSuccess(
            await api.get(teacher.identity, `/api/attendance/class/${classroom.id}?date=${date}`),
            200
        );
        expect(view.data).toHaveLength(1);
        expect(view.data[0]).toMatchObject({
            student_id: student.id,
            subject_id: subject.id,
            status: "present",
        });
    });

    it("allows a school admin to view attendance for a class on a given date", async () => {
        const teacher = await school.addFaculty();
        const viewableStudent = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, viewableStudent);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, viewableStudent, date);

        const view = expectSuccess(
            await api.get(school.admin.identity, `/api/attendance/class/${classroom.id}?date=${date}`),
            200
        );
        expect(view.data).toHaveLength(1);
        expect(view.data[0]).toMatchObject({
            student_id: viewableStudent.id,
            subject_id: subject.id,
            status: "present",
        });
    });

    it("denies a teacher from viewing attendance for a class they are not assigned to", async () => {
        const teacher = await school.addFaculty();
        const studentOther = await anotherSchool.addStudent();
        const teacherOther = await anotherSchool.addFaculty();
        const subjectOther = await anotherSchool.addSubject();
        const { classroom } = await buildEnrolledClass(
            anotherSchool,
            teacherOther,
            subjectOther,
            studentOther
        );

        expectError(
            await api.get(teacher.identity, `/api/attendance/class/${classroom.id}?date=${nextAttendanceDate()}`),
            403,
            "not assigned"
        );
    });

    it("allows a school admin to view attendance history for the school", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, date);

        const history = expectSuccess(
            await api.get(
                school.admin.identity,
                `/api/attendance/history?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );
        expect(history.data.data).toHaveLength(1);
        const historyRow = history.data.data[0];
        expect(historyRow).toMatchObject({
            class_id: classroom.id,
            subject_id: subject.id,
            attendance_date: date,
        });
        // COUNT() comes back as a string from the driver.
        expect(Number(historyRow.present_count)).toBe(1);
        expect(Number(historyRow.absent_count)).toBe(0);
        expect(Number(historyRow.total_count)).toBe(1);
    });

    it("allows a teacher to view their own attendance history", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        await markAttendance(teacher, classroom, subject, student, nextAttendanceDate());

        const history = expectSuccess(await api.get(teacher.identity, "/api/attendance/history"), 200);
        expect(history.data.data).toHaveLength(1);
        expect(history.data.data[0].class_id).toBe(classroom.id);
        expect(history.data.data[0].subject_id).toBe(subject.id);
    });

    it("filters attendance history by date range", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const older = nextAttendanceDate();
        const newer = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, older);
        await markAttendance(teacher, classroom, subject, student, newer);

        const history = expectSuccess(
            await api.get(
                teacher.identity,
                `/api/attendance/history?class_id=${classroom.id}&subject_id=${subject.id}&date_from=${older}&date_to=${older}`
            ),
            200
        );
        expect(history.data.data).toHaveLength(1);
        expect(history.data.data[0].attendance_date).toBe(older);
    });

    it("returns a faculty dashboard summary for the faculty", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);

        // Both marking and the dashboard bucket "today" in the server's
        // local timezone.
        expectSuccess(
            await markAttendance(teacher, classroom, subject, student, isoDate(new Date())),
            200
        );

        const summary = expectSuccess(
            await api.get(teacher.identity, "/api/attendance/faculty/summary"),
            200
        );
        expect(summary.data.today).toMatchObject({
            classes_with_attendance: 1,
            classes_pending: 0,
            total_classes_today: 1,
        });
        expect(summary.data.this_week).toMatchObject({
            total_sessions: 1,
            total_present: 1,
            total_absent: 0,
            attendance_rate: 100,
        });
    });

    it("denies a school admin from reading the faculty dashboard summary", async () => {
        expectError(
            await api.get(school.admin.identity, "/api/attendance/faculty/summary"),
            403,
            "Insufficient"
        );
    });

    it("allows a school admin to view attendance for the school on a given date", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, date);

        const view = expectSuccess(
            await api.get(school.admin.identity, `/api/attendance/school/${school.schoolId}?date=${date}`),
            200
        );
        expect(view.data).toHaveLength(1);
        expect(view.data[0]).toMatchObject({
            class_id: classroom.id,
            student_id: student.id,
            subject_id: subject.id,
            status: "present",
        });
    });

    it("denies a teacher from viewing school-wide attendance", async () => {
        const teacher = await school.addFaculty();

        expectError(
            await api.get(teacher.identity, `/api/attendance/school/${school.schoolId}?date=${nextAttendanceDate()}`),
            403,
            "Insufficient"
        );
    });

    it("allows a student to view attendance by subject and detail", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, date);

        const bySubject = expectSuccess(await api.get(student.identity, "/api/attendance/student/me"), 200);
        expect(bySubject.data).toHaveLength(1);
        expect(bySubject.data[0]).toMatchObject({
            subject_id: subject.id,
            subject_name: subject.name,
            class_id: classroom.id,
            class_name: classroom.name,
            total_sessions: 1,
            present_count: 1,
            absent_count: 0,
            attendance_rate: 100,
        });

        const detail = expectSuccess(
            await api.get(student.identity, `/api/attendance/student/me/${classroom.id}/${subject.id}`),
            200
        );
        expect(detail.data.data).toHaveLength(1);
        expect(detail.data.data[0]).toMatchObject({
            attendance_date: date,
            status: "present",
            teacher_name: `${teacher.firstName} ${teacher.lastName}`,
        });

        const records = expectSuccess(
            await api.get(student.identity, "/api/attendance/student/me/records"),
            200
        );
        expect(records.data.data).toHaveLength(1);
        expect(records.data.data[0]).toMatchObject({
            subject_id: subject.id,
            subject_name: subject.name,
            class_name: classroom.name,
            teacher_name: `${teacher.firstName} ${teacher.lastName}`,
            attendance_date: date,
            status: "present",
        });
    });

    it("denies a student from viewing attendance detail for a class they are not enrolled in", async () => {
        const teacher = await school.addFaculty();
        const otherTeacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        await buildEnrolledClass(school, teacher, subject, student);

        const otherClass = await school.addClass({ adviserId: otherTeacher.id });

        expectError(
            await api.get(student.identity, `/api/attendance/student/me/${otherClass.id}/${subject.id}`),
            403,
            "not enrolled"
        );
    });

    it("denies a teacher from viewing a student's attendance summary", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        await buildEnrolledClass(school, teacher, subject, student);

        expectError(await api.get(teacher.identity, "/api/attendance/student/me"), 403, "Insufficient");
    });

    it("denies a school admin from viewing a student's attendance summary", async () => {
        expectError(
            await api.get(school.admin.identity, "/api/attendance/student/me"),
            403,
            "Insufficient"
        );
    });

    it("allows a school admin to view the school attendance report", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, date);

        const report = expectSuccess(
            await api.get(
                school.admin.identity,
                `/api/attendance/school/${school.schoolId}/report?class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );
        expect(report.data.data).toHaveLength(1);
        expect(report.data.data[0]).toMatchObject({
            class_id: classroom.id,
            class_name: classroom.name,
            section: "A",
            grade_level: classroom.gradeLevel,
            subject_id: subject.id,
            subject_name: subject.name,
            student_id: student.id,
            student_name: `${student.firstName} ${student.lastName}`,
            attendance_date: date,
            status: "present",
            marked_by: teacher.id,
            marked_by_name: `${teacher.firstName} ${teacher.lastName}`,
        });
    });

    it("denies a teacher from viewing the school attendance report", async () => {
        const teacher = await school.addFaculty();
        expectError(
            await api.get(teacher.identity, `/api/attendance/school/${school.schoolId}/report`),
            403,
            "Insufficient"
        );
    });

    it("allows a school admin to view the school attendance matrix for a month", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();
        const year = date.slice(0, 4);
        const month = String(Number(date.slice(5, 7)));

        await markAttendance(teacher, classroom, subject, student, date);

        const matrix = expectSuccess(
            await api.get(
                school.admin.identity,
                `/api/attendance/school/${school.schoolId}/matrix?year=${year}&month=${month}&class_id=${classroom.id}&subject_id=${subject.id}`
            ),
            200
        );
        expect(matrix.data.data).toHaveLength(1);
        expect(matrix.data.data[0]).toMatchObject({
            class_id: classroom.id,
            class_name: classroom.name,
            section: "A",
            grade_level: classroom.gradeLevel,
            subject_id: subject.id,
            subject_name: subject.name,
            teacher_name: `${teacher.firstName} ${teacher.lastName}`,
            total_enrolled: 1,
            attendance_date: date,
            present_count: 1,
            absent_count: 0,
            marked_count: 1,
        });
    });

    it("validates the school attendance matrix query parameters", async () => {
        expectError(
            await api.get(
                school.admin.identity,
                `/api/attendance/school/${school.schoolId}/matrix?year=abcd&month=3`
            ),
            400,
            "four-digit year"
        );
        expectError(
            await api.get(
                school.admin.identity,
                `/api/attendance/school/${school.schoolId}/matrix?year=2025&month=13`
            ),
            400,
            "between 1 and 12"
        );
    });

    it("gates attendance reports separately from base attendance", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom } = await buildEnrolledClass(school, teacher, subject, student);
        const date = nextAttendanceDate();

        await markAttendance(teacher, classroom, subject, student, date);

        await school.setFeature("attendance_reports", false);
        try {
            expectSuccess(
                await api.get(teacher.identity, `/api/attendance/class/${classroom.id}?date=${date}`),
                200
            );
            expectError(
                await api.get(school.admin.identity, `/api/attendance/school/${school.schoolId}/report`),
                403,
                "not available"
            );
            expectError(
                await api.get(
                    school.admin.identity,
                    `/api/attendance/school/${school.schoolId}/matrix?year=2025&month=3`
                ),
                403,
                "not available"
            );
        } finally {
            await school.setFeature("attendance_reports", true);
        }
    });

    it("denies a teacher from viewing the school attendance matrix", async () => {
        const teacher = await school.addFaculty();
        expectError(
            await api.get(
                teacher.identity,
                `/api/attendance/school/${school.schoolId}/matrix?year=2025&month=3`
            ),
            403,
            "Insufficient"
        );
    });

    // --- Cross-school finalization ---

    it("denies a school admin from correcting a finalization belonging to another school", async () => {
        const teacherOther = await anotherSchool.addFaculty();
        const studentOther = await anotherSchool.addStudent();
        const subjectOther = await anotherSchool.addSubject();
        const { classroom, period } = await buildEnrolledClass(
            anotherSchool,
            teacherOther,
            subjectOther,
            studentOther
        );

        await api
            .post(teacherOther.identity, "/api/gradebook/finalize")
            .send({ class_id: classroom.id, subject_id: subjectOther.id, period_id: period.id });

        const listRes = await api
            .get(teacherOther.identity, `/api/gradebook/finalizations?class_id=${classroom.id}&subject_id=${subjectOther.id}`);
        const finalized = expectSuccess(listRes, 200).data[0];

        expectError(
            await api
                .put(school.admin.identity, `/api/gradebook/finalizations/${finalized.id}`)
                .send({ final_grade: 95, reason: "Cross-school" }),
            404,
            "not available"
        );
    });

    it("denies a teacher from recording scores on a finalized item", async () => {
        const teacher = await school.addFaculty();
        const student = await school.addStudent();
        const subject = await school.addSubject();
        const { classroom, period } = await buildEnrolledClass(school, teacher, subject, student);

        const item = expectSuccess(
            await api
                .post(teacher.identity, `/api/gradebook/items/${classroom.id}/${subject.id}`)
                .send({
                    category: "activities",
                    title: `Task ${RUN_ID}`,
                    max_score: 10,
                    due_date: "2025-03-10",
                    period_id: period.id,
                }),
            201
        );
        expectSuccess(
            await api
                .post(teacher.identity, "/api/gradebook/finalize")
                .send({ class_id: classroom.id, subject_id: subject.id, period_id: period.id }),
            200
        );

        expectError(
            await api
                .post(teacher.identity, `/api/gradebook/grades/${item.data.id}`)
                .send({ grades: [{ student_id: student.id, score: 5 }] }),
            400,
            "finalized"
        );
    });

    // --- Feature gating ---

    it("routes gradebook and attendance through feature gating", async () => {
        const teacher = await school.addFaculty();
        const subject = await school.addSubject();
        const { classroom } = await buildClass(school, teacher, subject);

        await school.setFeature("gradebook", false);
        await school.setFeature("attendance", false);
        try {
            expectError(
                await api.get(teacher.identity, `/api/gradebook/weights/${classroom.id}/${subject.id}`),
                403,
                "not available"
            );
            expectError(
                await api.get(teacher.identity, `/api/attendance/class/${classroom.id}?date=${nextAttendanceDate()}`),
                403,
                "not available"
            );
        } finally {
            // The feature switches live on the shared school fixture; leaving
            // them off would break every later test in this file.
            await school.setFeature("gradebook", true);
            await school.setFeature("attendance", true);
        }
    });
});
