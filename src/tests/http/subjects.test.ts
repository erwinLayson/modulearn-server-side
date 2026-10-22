import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture, createSuperAdmin } from "../helpers/fixtures.js";
import type { TestFaculty, TestSchool, TestSubject, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let facultyOne: TestFaculty;
let facultyTwo: TestFaculty;
let referencedSubject: TestSubject;
let subjectB: TestSubject;
let superAdmin: TestUser;

const subjectPayload = (name: string, overrides: Record<string, unknown> = {}) => ({
    name,
    subject_code: `CODE-${RUN_ID}`,
    description: `${name} description`,
    ...overrides,
});

const firstRow = async <T>(sql: string, params: (string | number | Buffer)[]): Promise<T | undefined> => {
    const [rows] = await connection!.execute(sql, params);
    return (rows as T[])[0];
};

const subjectId = async (name: string): Promise<string> => {
    const row = await firstRow<{ id: Buffer }>(`SELECT id FROM subjects WHERE name = ?`, [name]);
    return row!.id.toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
};

describe("subject management", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection);
        schoolB = await createSchoolFixture(connection);

        facultyOne = await schoolA.addFaculty();
        facultyTwo = await schoolA.addFaculty();
        subjectB = await schoolB.addSubject();

        referencedSubject = await schoolA.addSubject();
        const classroom = await schoolA.addClass({ adviserId: facultyOne.id });
        await schoolA.assignFacultyToClass(classroom, facultyOne, referencedSubject);
        const student = await schoolA.addStudent();
        await schoolA.enroll(student, classroom, [referencedSubject]);

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

    it("creates a subject and reads it back", async () => {
        const name = `Algebra ${RUN_ID}`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/subjects").send(subjectPayload(name)),
            201
        );

        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/subjects/school/${schoolA.schoolId}`)
        );
        const row = (list.data as { id: string; name: string; subject_code: string }[]).find(
            (entry) => entry.name === name
        );
        expect(row).toBeDefined();
        expect(row?.subject_code).toBe(`CODE-${RUN_ID}`);

        const one = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/subjects/${row!.id}`)
        );
        expect(one.data).toMatchObject({ id: row!.id, name });
    });

    it("requires a subject name", async () => {
        expectError(
            await api.post(schoolA.admin.identity, "/api/subjects").send({ description: "No name" }),
            400,
            "Invalid data: name"
        );
    });

    it("rejects a duplicate name in the same school and allows another school", async () => {
        const name = `Biology ${RUN_ID}`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/subjects").send(subjectPayload(name)),
            201
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/subjects").send(subjectPayload(name)),
            409
        );
        expectSuccess(
            await api.post(schoolB.admin.identity, "/api/subjects").send(subjectPayload(name)),
            201
        );
    });

    it("lists all subjects for the super admin only", async () => {
        const allowed = expectSuccess(await api.get(superAdmin.identity, "/api/subjects"));
        expect((allowed.data as { school_id: number }[]).length).toBeGreaterThan(0);

        expectError(
            await api.get(schoolA.admin.identity, "/api/subjects"),
            403,
            "Insufficient permissions"
        );
    });

    it("updates and deletes an unreferenced subject", async () => {
        const name = `Chemistry ${RUN_ID}`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/subjects").send(subjectPayload(name)),
            201
        );
        const id = await subjectId(name);

        expectSuccess(
            await api
                .put(schoolA.admin.identity, `/api/subjects/${id}`)
                .send({ name: `${name} Updated`, subject_code: "CHEM-2" })
        );

        const updated = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/subjects/${id}`)
        );
        expect(updated.data).toMatchObject({ name: `${name} Updated`, subject_code: "CHEM-2" });

        expectSuccess(await api.delete(schoolA.admin.identity, `/api/subjects/${id}`));
        expect(
            await firstRow(`SELECT id FROM subjects WHERE id = ?`, [
                Buffer.from(id.replace(/-/g, ""), "hex"),
            ])
        ).toBeUndefined();
    });

    it("soft-deletes a subject that is referenced by an enrollment", async () => {
        expectSuccess(
            await api.delete(schoolA.admin.identity, `/api/subjects/${referencedSubject.id}`)
        );

        const row = await firstRow<{ is_active: number }>(
            `SELECT is_active FROM subjects WHERE id = ?`,
            [Buffer.from(referencedSubject.id.replace(/-/g, ""), "hex")]
        );
        expect(row).toBeDefined();
        expect(Number(row?.is_active)).toBe(0);
    });

    it("assigns, lists and removes faculty from a subject", async () => {
        const name = `Physics ${RUN_ID}`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/subjects").send(subjectPayload(name)),
            201
        );
        const id = await subjectId(name);

        expectSuccess(
            await api
                .post(schoolA.admin.identity, `/api/subjects/${id}/faculties`)
                .send({ faculty_id: facultyOne.id }),
            201
        );

        const assigned = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/subjects/${id}/faculties`)
        );
        expect((assigned.data as { id: string }[]).map((entry) => entry.id)).toContain(facultyOne.id);

        expectError(
            await api
                .post(schoolA.admin.identity, `/api/subjects/${id}/faculties`)
                .send({ faculty_id: facultyOne.id }),
            409
        );

        expectSuccess(
            await api.delete(
                schoolA.admin.identity,
                `/api/subjects/${id}/faculties/${facultyOne.id}`
            )
        );

        const after = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/subjects/${id}/faculties`)
        );
        expect(after.data).toEqual([]);
    });

    it("returns only the subjects assigned to the calling faculty", async () => {
        const name = `Assigned ${RUN_ID}`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/subjects").send(subjectPayload(name)),
            201
        );
        const id = await subjectId(name);

        expectSuccess(
            await api
                .post(schoolA.admin.identity, `/api/subjects/${id}/faculties`)
                .send({ faculty_id: facultyOne.id }),
            201
        );

        const assigned = expectSuccess(
            await api.get(facultyOne.identity, "/api/subjects/assigned")
        );
        expect((assigned.data as { id: string }[]).map((entry) => entry.id)).toContain(id);

        const other = expectSuccess(
            await api.get(facultyTwo.identity, "/api/subjects/assigned")
        );
        expect((other.data as { id: string }[]).map((entry) => entry.id)).not.toContain(id);
    });

    it("lists the faculties of a school for assignment", async () => {
        const res = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/subjects/faculties/school/${schoolA.schoolId}`
            )
        );
        expect((res.data as { id: string }[]).map((entry) => entry.id)).toContain(facultyOne.id);
    });

    it("rejects cross-school access", async () => {
        expectError(
            await api.get(schoolA.admin.identity, `/api/subjects/${subjectB.id}`),
            403,
            "cross-school violation"
        );
        expectError(
            await api
                .put(schoolA.admin.identity, `/api/subjects/${subjectB.id}`)
                .send({ name: "Hijacked" }),
            403
        );
    });

    it("reports unknown subjects as inaccessible", async () => {
        expectError(
            await api.get(
                schoolA.admin.identity,
                "/api/subjects/00000000-0000-0000-0000-000000000000"
            ),
            403,
            "Resource not found"
        );
    });

    it("blocks faculty from subject management", async () => {
        expectError(
            await api
                .post(facultyOne.identity, "/api/subjects")
                .send(subjectPayload(`Denied ${RUN_ID}`)),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.delete(facultyOne.identity, `/api/subjects/${referencedSubject.id}`),
            403
        );
    });
});
