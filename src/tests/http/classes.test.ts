import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture, createSuperAdmin } from "../helpers/fixtures.js";
import type {
    TestClass,
    TestFaculty,
    TestSchool,
    TestStudent,
    TestSubject,
    TestUser,
} from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let superAdmin: TestUser;

const classPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    class_name: `Class ${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`,
    school_year_id: schoolA.currentSchoolYear.id,
    capacity: 40,
    section: "A",
    grade_level: "7",
    schedule: [{ day: "Monday", start: "08:00", end: "09:00" }],
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

describe("class management", () => {
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

    it("creates a class for the authenticated admin's school and lists it with details", async () => {
        const adviser = await schoolA.addFaculty();
        const payload = classPayload({
            faculty_id: adviser.id,
            school_id: schoolB.schoolId, // spoofed; school scope comes from the token
            class_name: `Scoped ${RUN_ID}`,
            capacity: 30,
        });

        expectSuccess(await api.post(schoolA.admin.identity, "/api/classes").send(payload), 201);

        const row = await firstRow<{
            id: Buffer;
            school_id: number;
            capacity: number;
            section: string;
            grade_level: string;
        }>(
            `SELECT id, school_id, capacity, section, grade_level FROM classes WHERE class_name = ?`,
            [payload.class_name as string]
        );
        expect(row).toMatchObject({
            school_id: schoolA.schoolId,
            capacity: 30,
            section: "A",
            grade_level: "7",
        });

        // Requesting another school's list as a school admin is overridden to the token's school.
        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/classes/school/${schoolB.schoolId}`)
        );
        const created = list.data.find((c: { id: string }) => c.id === bufferToUUID(row!.id));
        expect(created).toMatchObject({
            class_name: payload.class_name,
            school_id: schoolA.schoolId,
            capacity: 30,
            faculty_name: `${adviser.firstName} ${adviser.lastName}`,
        });
        expect(created.schedule).toEqual(payload.schedule);
    });

    it("requires a class name, school year and faculty id", async () => {
        const adviser = await schoolA.addFaculty();

        expectError(
            await api.post(schoolA.admin.identity, "/api/classes").send(
                classPayload({ faculty_id: adviser.id, class_name: "   " })
            ),
            400,
            "Invalid data: class_name"
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/classes").send(
                classPayload({ faculty_id: adviser.id, school_year_id: null })
            ),
            400,
            "Invalid data: school_year_id"
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/classes").send(
                classPayload({ faculty_id: "   " })
            ),
            400,
            "Invalid data: faculty_id"
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/classes").send(
                classPayload({ faculty_id: "not-a-uuid" })
            ),
            400,
            "Invalid data: faculty_id"
        );
    });

    it("allows the optional capacity, section, grade level and schedule to be omitted", async () => {
        const adviser = await schoolA.addFaculty();
        const className = `Minimal ${RUN_ID}`;

        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/classes").send(
                classPayload({ faculty_id: adviser.id, class_name: className, capacity: null, section: null, grade_level: null, schedule: null })
            ),
            201
        );

        const row = await firstRow<{
            capacity: number | null;
            section: string | null;
            grade_level: string | null;
            schedule: string | null;
        }>(
            `SELECT capacity, section, grade_level, schedule FROM classes WHERE class_name = ?`,
            [className]
        );
        expect(row).toMatchObject({ capacity: null, section: null, grade_level: null, schedule: null });
    });

    it("prevents a teacher from advising two classes in the same school year", async () => {
        const adviser = await schoolA.addFaculty();

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/classes")
                .send(classPayload({ faculty_id: adviser.id })),
            201
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/classes")
                .send(classPayload({ faculty_id: adviser.id })),
            400,
            "already an adviser of another class in this school year"
        );

        // The same teacher may advise a class in a different school year.
        const nextYear = await schoolA.addSchoolYear({ name: `Next ${RUN_ID}` });
        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/classes")
                .send(classPayload({ faculty_id: adviser.id, school_year_id: nextYear.id })),
            201
        );
    });

    it("lists only the school's active classes and filters by school year", async () => {
        const adviser = await schoolA.addFaculty();
        const otherYear = await schoolA.addSchoolYear({ name: `Filter ${RUN_ID}` });
        const currentClass = await schoolA.addClass({ adviserId: adviser.id });
        const oldClass = await schoolA.addClass({
            adviserId: (await schoolA.addFaculty()).id,
            schoolYearId: otherYear.id,
        });

        const filtered = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/classes/school/${schoolA.schoolId}?school_year_id=${otherYear.id}`
            )
        );
        const ids = filtered.data.map((c: { id: string }) => c.id);
        expect(ids).toContain(oldClass.id);
        expect(ids).not.toContain(currentClass.id);
        expect(filtered.data.every((c: { school_id: number }) => c.school_id === schoolA.schoolId))
            .toBe(true);

        const all = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/classes/school/${schoolA.schoolId}`)
        );
        const allIds = all.data.map((c: { id: string }) => c.id);
        expect(allIds).toContain(currentClass.id);
        expect(allIds).toContain(oldClass.id);
    });

    it("returns a single class with adviser details and enforces school ownership", async () => {
        const adviser = await schoolA.addFaculty();
        const classroom = await schoolA.addClass({ adviserId: adviser.id });
        const otherClass = await schoolB.addClass({
            adviserId: (await schoolB.addFaculty()).id,
        });

        const body = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/classes/${classroom.id}`)
        );
        expect(body.data).toMatchObject({
            id: classroom.id,
            class_name: classroom.name,
            school_id: schoolA.schoolId,
            faculty_id: adviser.id,
            faculty_name: `${adviser.firstName} ${adviser.lastName}`,
        });

        expectError(
            await api.get(schoolA.admin.identity, `/api/classes/${otherClass.id}`),
            403,
            "Access denied: cross-school violation"
        );
        expectError(
            await api.get(
                schoolA.admin.identity,
                "/api/classes/00000000-0000-0000-0000-000000000000"
            ),
            403,
            "Resource not found"
        );
    });

    it("updates class fields", async () => {
        const classroom = await schoolA.addClass({
            adviserId: (await schoolA.addFaculty()).id,
            name: `Before ${RUN_ID}`,
        });
        const newName = `After ${RUN_ID}`;
        const schedule = [{ day: "Friday", start: "10:00", end: "11:00" }];

        expectSuccess(
            await api.put(schoolA.admin.identity, `/api/classes/${classroom.id}`).send({
                class_name: newName,
                capacity: 55,
                section: "B",
                grade_level: "8",
                schedule,
            })
        );

        const body = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/classes/${classroom.id}`)
        );
        expect(body.data).toMatchObject({
            class_name: newName,
            capacity: 55,
            section: "B",
            grade_level: "8",
        });
        expect(body.data.schedule).toEqual(schedule);
    });

    it("assigns a teacher to a class subject and rejects duplicates or a missing subject", async () => {
        const adviser = await schoolA.addFaculty();
        const teacher = await schoolA.addFaculty();
        const subject = await schoolA.addSubject();
        const classroom = await schoolA.addClass({ adviserId: adviser.id });

        expectError(
            await api
                .post(schoolA.admin.identity, `/api/classes/${classroom.id}/faculties`)
                .send({ faculty_id: teacher.id }),
            400,
            "Subject is required when assigning a teacher to a class"
        );

        expectSuccess(
            await api
                .post(schoolA.admin.identity, `/api/classes/${classroom.id}/faculties`)
                .send({ faculty_id: teacher.id, subject_id: subject.id }),
            201
        );

        const assigned = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/classes/${classroom.id}/faculties`)
        );
        expect(assigned.data).toHaveLength(1);
        expect(assigned.data[0]).toMatchObject({
            id: teacher.id,
            subject_id: subject.id,
            subject_name: subject.name,
        });

        expectError(
            await api
                .post(schoolA.admin.identity, `/api/classes/${classroom.id}/faculties`)
                .send({ faculty_id: teacher.id, subject_id: subject.id }),
            400,
            "already assigned to this subject"
        );
        expectError(
            await api
                .post(
                    schoolA.admin.identity,
                    `/api/classes/00000000-0000-0000-0000-000000000000/faculties`
                )
                .send({ faculty_id: teacher.id, subject_id: subject.id }),
            403,
            "Resource not found"
        );
    });

    it("replaces and removes a teacher on a class subject", async () => {
        const classroom = await schoolA.addClass({
            adviserId: (await schoolA.addFaculty()).id,
        });
        const original = await schoolA.addFaculty();
        const replacement = await schoolA.addFaculty();
        const subject = await schoolA.addSubject();
        const base = `/api/classes/${classroom.id}/faculties`;

        expectSuccess(
            await api
                .post(schoolA.admin.identity, base)
                .send({ faculty_id: original.id, subject_id: subject.id }),
            201
        );

        expectError(
            await api
                .put(schoolA.admin.identity, `${base}/${original.id}`)
                .send({ new_faculty_id: replacement.id }),
            400,
            "Subject is required when assigning a teacher to a class"
        );

        expectSuccess(
            await api
                .put(schoolA.admin.identity, `${base}/${original.id}`)
                .send({ new_faculty_id: replacement.id, subject_id: subject.id })
        );

        const afterReplace = expectSuccess(
            await api.get(schoolA.admin.identity, base)
        );
        expect(afterReplace.data.map((f: { id: string }) => f.id)).toEqual([replacement.id]);

        expectSuccess(
            await api.delete(schoolA.admin.identity, `${base}/${replacement.id}`)
        );
        const afterRemove = expectSuccess(await api.get(schoolA.admin.identity, base));
        expect(afterRemove.data).toEqual([]);
    });

    it("lists available advisers, excluding teachers who already advise a class this year", async () => {
        const adviser = await schoolA.addFaculty();
        const free = await schoolA.addFaculty();
        await schoolA.addClass({ adviserId: adviser.id });

        const body = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/classes/available-advisers/${schoolA.schoolId}?school_year_id=${schoolA.currentSchoolYear.id}`
            )
        );
        const ids = body.data.map((f: { id: string }) => f.id);
        expect(ids).not.toContain(adviser.id);
        expect(ids).toContain(free.id);

        // Without a school year the endpoint returns an empty list instead of failing.
        const noYear = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/classes/available-advisers/${schoolA.schoolId}`
            )
        );
        expect(noYear.data).toEqual([]);
    });

    it("hard deletes a class without enrollments and soft deletes one with enrollments", async () => {
        const unreferenced = await schoolA.addClass({
            adviserId: (await schoolA.addFaculty()).id,
        });
        expectSuccess(await api.delete(schoolA.admin.identity, `/api/classes/${unreferenced.id}`));
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM classes WHERE id = ?`, [
                Buffer.from(unreferenced.id.replace(/-/g, ""), "hex"),
            ])
        ).toBe(0);

        const enrolled: TestClass = await schoolA.addClass({
            adviserId: (await schoolA.addFaculty()).id,
        });
        const student: TestStudent = await schoolA.addStudent();
        await schoolA.enroll(student, enrolled);

        expectSuccess(await api.delete(schoolA.admin.identity, `/api/classes/${enrolled.id}`));
        const row = await firstRow<{ is_active: number }>(
            `SELECT is_active FROM classes WHERE id = ?`,
            [Buffer.from(enrolled.id.replace(/-/g, ""), "hex")]
        );
        expect(Number(row!.is_active)).toBe(0);

        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/classes/school/${schoolA.schoolId}`)
        );
        expect(list.data.map((c: { id: string }) => c.id)).not.toContain(enrolled.id);
    });

    it("lists all classes for a super admin only", async () => {
        const teacher: TestFaculty = await schoolA.addFaculty();
        const subject: TestSubject = await schoolA.addSubject();
        const classroom = await schoolA.addClass({ adviserId: teacher.id });
        await schoolA.assignFacultyToClass(classroom, teacher, subject);

        const body = expectSuccess(await api.get(superAdmin.identity, "/api/classes"));
        const found = body.data.find((c: { id: string }) => c.id === classroom.id);
        expect(found).toMatchObject({
            school_id: schoolA.schoolId,
        });
        expect(found?.school_name).toEqual(expect.any(String));

        expectError(
            await api.get(schoolA.admin.identity, "/api/classes"),
            403,
            "Insufficient permissions"
        );
    });

    it("denies class writes to faculty and super admins", async () => {
        const adviser = await schoolA.addFaculty();
        const classroom = await schoolA.addClass({ adviserId: adviser.id });

        expectError(
            await api.post(adviser.identity, "/api/classes").send(
                classPayload({ faculty_id: adviser.id })
            ),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.put(adviser.identity, `/api/classes/${classroom.id}`).send({
                class_name: "Nope",
            }),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.delete(adviser.identity, `/api/classes/${classroom.id}`),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.post(superAdmin.identity, "/api/classes").send(
                classPayload({ faculty_id: adviser.id })
            ),
            403,
            "Insufficient permissions"
        );
    });

    it("returns classes for a faculty member, both advised and taught", async () => {
        const teacher = await schoolA.addFaculty();
        const subject = await schoolA.addSubject();
        const ownClass = await schoolA.addClass({ adviserId: teacher.id });
        const taughtClass = await schoolA.addClass({
            adviserId: (await schoolA.addFaculty()).id,
        });
        await schoolA.assignFacultyToClass(taughtClass, teacher, subject);

        const classes = expectSuccess(
            await api.get(teacher.identity, `/api/classes/faculty/${teacher.id}`)
        );
        expect(classes.data.map((c: { id: string }) => c.id)).toContain(ownClass.id);

        const assigned = expectSuccess(
            await api.get(teacher.identity, `/api/classes/faculty/${teacher.id}/assigned`)
        );
        const advised = assigned.data.find((c: { id: string }) => c.id === ownClass.id);
        expect(advised.adviser_role).toBe(true);

        const taught = assigned.data.find((c: { id: string }) => c.id === taughtClass.id);
        expect(taught.adviser_role).toBe(false);
        expect(taught.subjects).toEqual([{ id: subject.id, name: subject.name }]);
    });
});
