import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture, createSuperAdmin } from "../helpers/fixtures.js";
import type { TestClass, TestFaculty, TestSchool, TestStudent, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let superAdmin: TestUser;

const enrollmentPayload = (
    student: TestStudent,
    classroom: TestClass,
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    student_id: student.id,
    class_id: classroom.id,
    school_year_id: classroom.schoolYearId,
    grade_level: Number(classroom.gradeLevel),
    subject_ids: [],
    ...overrides,
});

const firstRow = async <T>(
    sql: string,
    params: (string | number | Buffer)[]
): Promise<T | undefined> => {
    const [rows] = await connection!.execute(sql, params);
    return (rows as T[])[0];
};

const count = async (sql: string, params: (string | number | Buffer)[] = []): Promise<number> => {
    const row = await firstRow<{ cnt: number }>(sql, params);
    return Number(row?.cnt ?? 0);
};

const classWithAdviser = async (options: { capacity?: number } = {}): Promise<{
    classroom: TestClass;
    adviser: TestFaculty;
}> => {
    const adviser = await schoolA.addFaculty();
    const classroom = await schoolA.addClass({ adviserId: adviser.id, ...options });
    return { classroom, adviser };
};

describe("student enrollment", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection);
        schoolB = await createSchoolFixture(connection);
        superAdmin = await createSuperAdmin(connection);
    });

    afterAll(async () => {
        if (!connection) return;
        try {
            await cleanupTestData(connection, {
                schoolIds: [schoolA.schoolId, schoolB.schoolId],
                userIds: [superAdmin.id],
            });
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    it("enrolls a student, snapshots the class and returns the roster", async () => {
        const { classroom, adviser } = await classWithAdviser();
        const student = await schoolA.addStudent();
        const subject = await schoolA.addSubject();
        await schoolA.assignFacultyToClass(classroom, adviser, subject);

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom, { subject_ids: [subject.id] })),
            201
        );

        const row = await firstRow<{
            status: string;
            class_name_snapshot: string;
            section_snapshot: string;
            adviser_name_snapshot: string;
        }>(
            `SELECT status, class_name_snapshot, section_snapshot, adviser_name_snapshot
             FROM enrollments WHERE student_id = ? AND class_id = ?`,
            [
                Buffer.from(student.id.replace(/-/g, ""), "hex"),
                Buffer.from(classroom.id.replace(/-/g, ""), "hex"),
            ]
        );
        expect(row).toMatchObject({
            status: "active",
            class_name_snapshot: classroom.name,
            section_snapshot: "A",
            adviser_name_snapshot: `${adviser.firstName} ${adviser.lastName}`,
        });

        const roster = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/enrollments/class/${classroom.id}/school-year/${classroom.schoolYearId}`
            )
        );
        expect(roster.data).toHaveLength(1);
        expect(roster.data[0]).toMatchObject({
            student_id: student.id,
            student_name: `${student.firstName} ${student.lastName}`,
            student_email: student.email,
            class_name: classroom.name,
            section: "A",
            status: "active",
            school_year_name: schoolA.currentSchoolYear.name,
        });
        expect(roster.data[0].subjects).toEqual([
            { id: subject.id, name: subject.name, teacher_name: `${adviser.firstName} ${adviser.lastName}` },
        ]);
    });

    it("requires the student, class, school year and grade level", async () => {
        const { classroom } = await classWithAdviser();
        const student = await schoolA.addStudent();

        for (const [overrides, message] of [
            [{ student_id: undefined }, "Invalid data: student_id"],
            [{ class_id: undefined }, "Invalid data: class_id"],
            [{ school_year_id: undefined }, "Invalid data: school_year_id"],
            [{ grade_level: undefined }, "Invalid data: grade_level"],
        ] as [Record<string, unknown>, string][]) {
            expectError(
                await api
                    .post(schoolA.admin.identity, "/api/enrollments")
                    .send(enrollmentPayload(student, classroom, overrides)),
                400,
                message
            );
        }
    });

    it("rejects an unknown class and a grade level that does not match", async () => {
        const { classroom } = await classWithAdviser();
        const student = await schoolA.addStudent();

        expectError(
            await api.post(schoolA.admin.identity, "/api/enrollments").send(
                enrollmentPayload(student, classroom, {
                    class_id: "00000000-0000-0000-0000-000000000000",
                })
            ),
            404,
            "Class not found"
        );

        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom, { grade_level: 8 })),
            400,
            "does not match class grade level"
        );
    });

    it("allows one active enrollment per school year", async () => {
        const first = await classWithAdviser();
        const second = await classWithAdviser();
        const student = await schoolA.addStudent();

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, first.classroom)),
            201
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, second.classroom)),
            400,
            "already has an active enrollment for this school year"
        );
    });

    it("blocks re-enrolling a completed record but allows it after a transfer", async () => {
        const { classroom } = await classWithAdviser();
        const student = await schoolA.addStudent();

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom)),
            201
        );

        const enrollment = await firstRow<{ id: Buffer }>(
            `SELECT id FROM enrollments WHERE student_id = ?`,
            [Buffer.from(student.id.replace(/-/g, ""), "hex")]
        );
        const enrollmentId = bufferToUUID(enrollment!.id);

        expectSuccess(
            await api
                .put(schoolA.admin.identity, `/api/enrollments/${enrollmentId}/status`)
                .send({ status: "completed" })
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom)),
            400,
            "already enrolled in this class for this school year"
        );

        expectSuccess(
            await api
                .put(schoolA.admin.identity, `/api/enrollments/${enrollmentId}/status`)
                .send({ status: "transferred" })
        );
        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom)),
            201
        );
    });

    it("enforces class capacity for active enrollments", async () => {
        const { classroom } = await classWithAdviser({ capacity: 1 });
        const firstStudent = await schoolA.addStudent();
        const secondStudent = await schoolA.addStudent();

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(firstStudent, classroom)),
            201
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(secondStudent, classroom)),
            400,
            "Class is at full capacity (1 students)"
        );
    });

    it("rejects enrolling a student from another school", async () => {
        const { classroom } = await classWithAdviser();
        const studentB = await schoolB.addStudent();

        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(studentB, classroom)),
            403,
            "cross-school violation"
        );

        const studentA = await schoolA.addStudent();
        const classroomBAdviser = await schoolB.addFaculty();
        const classroomB = await schoolB.addClass({ adviserId: classroomBAdviser.id });
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(studentA, classroomB)),
            403,
            "cross-school violation"
        );
    });

    it("only accepts subjects that are assigned to the class", async () => {
        const { classroom, adviser } = await classWithAdviser();
        const student = await schoolA.addStudent();
        const assigned = await schoolA.addSubject();
        const unassigned = await schoolA.addSubject();
        await schoolA.assignFacultyToClass(classroom, adviser, assigned);

        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom, { subject_ids: [unassigned.id] })),
            400,
            "is not assigned to this class"
        );

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom, { subject_ids: [assigned.id] })),
            201
        );
        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM enrollment_subjects es
                 INNER JOIN enrollments e ON e.id = es.enrollment_id
                 WHERE e.student_id = ?`,
                [Buffer.from(student.id.replace(/-/g, ""), "hex")]
            )
        ).toBe(1);
    });

    it("updates the status and deletes an enrollment with its subject rows", async () => {
        const { classroom, adviser } = await classWithAdviser();
        const student = await schoolA.addStudent();
        const subject = await schoolA.addSubject();
        await schoolA.assignFacultyToClass(classroom, adviser, subject);

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom, { subject_ids: [subject.id] })),
            201
        );

        const enrollment = await firstRow<{ id: Buffer }>(
            `SELECT id FROM enrollments WHERE student_id = ?`,
            [Buffer.from(student.id.replace(/-/g, ""), "hex")]
        );
        const enrollmentId = bufferToUUID(enrollment!.id);

        expectSuccess(
            await api
                .put(schoolA.admin.identity, `/api/enrollments/${enrollmentId}/status`)
                .send({ status: "dropped" })
        );
        const updated = await firstRow<{ status: string }>(
            `SELECT status FROM enrollments WHERE id = ?`,
            [Buffer.from(enrollmentId.replace(/-/g, ""), "hex")]
        );
        expect(updated?.status).toBe("dropped");

        expectSuccess(
            await api.delete(schoolA.admin.identity, `/api/enrollments/${enrollmentId}`)
        );
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM enrollments WHERE id = ?`, [
                Buffer.from(enrollmentId.replace(/-/g, ""), "hex"),
            ])
        ).toBe(0);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM enrollment_subjects WHERE enrollment_id = ?`, [
                Buffer.from(enrollmentId.replace(/-/g, ""), "hex"),
            ])
        ).toBe(0);
    });

    it("returns a student's enrollments, current-year enrollment and active classes", async () => {
        const { classroom, adviser } = await classWithAdviser();
        const student = await schoolA.addStudent();
        const subject = await schoolA.addSubject();
        await schoolA.assignFacultyToClass(classroom, adviser, subject);

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom, { subject_ids: [subject.id] })),
            201
        );

        const all = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/enrollments/student/${student.id}`)
        );
        expect(all.data).toHaveLength(1);
        expect(all.data[0]).toMatchObject({
            class_id: classroom.id,
            class_name: classroom.name,
            school_year_id: classroom.schoolYearId,
            status: "active",
        });
        expect(all.data[0].subjects[0]).toMatchObject({
            id: subject.id,
            name: subject.name,
        });

        const forYear = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/enrollments/student/${student.id}/school-year/${classroom.schoolYearId}`
            )
        );
        expect(forYear.data).toMatchObject({ class_id: classroom.id, class_name: classroom.name });

        const classes = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/enrollments/student/${student.id}/classes`)
        );
        expect(classes.data).toEqual([
            {
                class_id: classroom.id,
                class_name: classroom.name,
                subjects: [{ id: subject.id, name: subject.name }],
            },
        ]);

        const otherYear = await schoolA.addSchoolYear({ name: `Empty ${RUN_ID}` });
        const none = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/enrollments/student/${student.id}/school-year/${otherYear.id}`
            )
        );
        expect(none.data).toBeNull();
    });

    it("allows faculty to change status but denies them enrollment and enrollment deletion", async () => {
        const { classroom } = await classWithAdviser();
        const student = await schoolA.addStudent();
        const teacher = await schoolA.addFaculty();

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload(student, classroom)),
            201
        );
        const enrollment = await firstRow<{ id: Buffer }>(
            `SELECT id FROM enrollments WHERE student_id = ?`,
            [Buffer.from(student.id.replace(/-/g, ""), "hex")]
        );
        const enrollmentId = bufferToUUID(enrollment!.id);

        expectError(
            await api.post(teacher.identity, "/api/enrollments").send(
                enrollmentPayload(student, classroom)
            ),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api
                .delete(teacher.identity, `/api/enrollments/${enrollmentId}`),
            403,
            "Insufficient permissions"
        );
        expectSuccess(
            await api
                .put(teacher.identity, `/api/enrollments/${enrollmentId}/status`)
                .send({ status: "completed" })
        );
        expectError(
            await api
                .put(student.identity, `/api/enrollments/${enrollmentId}/status`)
                .send({ status: "active" }),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.post(superAdmin.identity, "/api/enrollments").send(
                enrollmentPayload(student, classroom)
            ),
            403,
            "Insufficient permissions"
        );
    });
});
