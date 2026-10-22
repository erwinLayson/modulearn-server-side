import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { api, expectError, expectSuccess, loginRequest } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture } from "../helpers/fixtures.js";
import type { TestClass, TestFaculty, TestSchool, TestSubject } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let adviser: TestFaculty;
let subject: TestSubject;
let classroom: TestClass;

const facultyPayload = (email: string, overrides: Record<string, unknown> = {}) => ({
    first_name: "New",
    last_name: "Teacher",
    email,
    contact_number: "0900-000-0000",
    faculty_role: "teacher",
    ...overrides,
});

const firstRow = async <T>(sql: string, params: (string | number | Buffer)[]): Promise<T | undefined> => {
    const [rows] = await connection!.execute(sql, params);
    return (rows as T[])[0];
};

const defaultPassword = (): string => process.env.USER_DEFAULT_PASSWORD as string;

describe("faculty administration", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection);
        schoolB = await createSchoolFixture(connection);

        adviser = await schoolA.addFaculty();
        subject = await schoolA.addSubject();
        classroom = await schoolA.addClass({ adviserId: adviser.id });
        await schoolA.assignFacultyToClass(classroom, adviser, subject);
    });

    afterAll(async () => {
        if (!connection) return;
        try {
            await cleanupTestData(connection, {
                schoolIds: [schoolA.schoolId, schoolB.schoolId],
            });
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    it("registers a faculty member who can log in with the default password", async () => {
        const email = `faculty-new-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(email)),
            201
        );

        const login = await loginRequest(email, defaultPassword(), schoolA.schoolId);
        const body = expectSuccess(login);
        expect(body.data.user).toMatchObject({ role: "faculty", first_name: "New" });

        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/faculties/school/${schoolA.schoolId}`)
        );
        expect((list.data as { email: string }[]).some((entry) => entry.email === email)).toBe(true);
    });

    it("requires the contact number and faculty role", async () => {
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/faculties")
                .send({ first_name: "A", last_name: "B", email: `missing-${RUN_ID}@test.local` }),
            400,
            "Invalid data: contact_number"
        );
    });

    it("rejects a duplicate email in the same school", async () => {
        const email = `faculty-dup-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(email)),
            201
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(email)),
            400,
            "Email already exists in this school"
        );
    });

    it("allows the same email in another school", async () => {
        const email = `faculty-shared-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(email)),
            201
        );
        expectSuccess(
            await api.post(schoolB.admin.identity, "/api/faculties").send(facultyPayload(email)),
            201
        );
    });

    it("lists its own school and reads a single faculty member", async () => {
        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/faculties/school/${schoolA.schoolId}`)
        );
        const ids = (list.data as { id: string }[]).map((entry) => entry.id);
        expect(ids).toContain(adviser.id);

        const one = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/faculties/${adviser.id}`)
        );
        expect(one.data).toMatchObject({ id: adviser.id, email: adviser.email });

        // verifyOwnership answers unknown ids with 403 before the service runs.
        expectError(
            await api.get(
                schoolA.admin.identity,
                "/api/faculties/00000000-0000-0000-0000-000000000000"
            ),
            403,
            "Resource not found"
        );
    });

    it("updates a faculty member and syncs the account email", async () => {
        const originalEmail = `faculty-edit-${RUN_ID}@test.local`;
        const newEmail = `faculty-edited-${RUN_ID}@test.local`;
        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/faculties")
                .send(facultyPayload(originalEmail)),
            201
        );

        const created = await firstRow<{ id: Buffer }>(
            `SELECT id FROM faculties WHERE email = ?`,
            [originalEmail]
        );
        const id = created!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        expectSuccess(
            await api
                .put(schoolA.admin.identity, `/api/faculties/${id}`)
                .send({ contact_number: "0999-999-9999", email: newEmail })
        );

        const user = await firstRow<{ email: string }>(
            `SELECT email FROM users WHERE id = ?`,
            [created!.id]
        );
        expect(user?.email).toBe(newEmail);

        expectSuccess(await loginRequest(newEmail, defaultPassword(), schoolA.schoolId));
    });

    it("rejects an email that already exists on update", async () => {
        const first = `faculty-first-${RUN_ID}@test.local`;
        const second = `faculty-second-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(first)),
            201
        );
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(second)),
            201
        );

        const secondRow = await firstRow<{ id: Buffer }>(
            `SELECT id FROM faculties WHERE email = ?`,
            [second]
        );
        const id = secondRow!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        expectError(
            await api
                .put(schoolA.admin.identity, `/api/faculties/${id}`)
                .send({ email: first }),
            409,
            "A faculty member with this email already exists in this school."
        );
    });

    it("soft-deletes a referenced faculty member and deactivates the account", async () => {
        const email = `faculty-delete-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(email)),
            201
        );

        const created = await firstRow<{ id: Buffer }>(
            `SELECT id FROM faculties WHERE email = ?`,
            [email]
        );
        const id = created!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        const referencedClass = await schoolA.addClass({ adviserId: id });
        expect(referencedClass.id).toBeTruthy();

        expectSuccess(await api.delete(schoolA.admin.identity, `/api/faculties/${id}`));

        const row = await firstRow<{ is_active: number }>(
            `SELECT is_active FROM faculties WHERE id = ?`,
            [created!.id]
        );
        expect(Number(row?.is_active)).toBe(0);

        const user = await firstRow<{ status: string }>(
            `SELECT status FROM users WHERE id = ?`,
            [created!.id]
        );
        expect(user?.status).toBe("inactive");

        expectError(
            await loginRequest(email, defaultPassword(), schoolA.schoolId),
            401,
            "Account is inactive"
        );
    });

    it("keeps an unreferenced faculty row as an inactive soft delete", async () => {
        const email = `faculty-soft-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/faculties").send(facultyPayload(email)),
            201
        );

        const created = await firstRow<{ id: Buffer }>(
            `SELECT id FROM faculties WHERE email = ?`,
            [email]
        );
        const id = created!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        expectSuccess(await api.delete(schoolA.admin.identity, `/api/faculties/${id}`));

        const row = await firstRow<{ is_active: number }>(
            `SELECT is_active FROM faculties WHERE id = ?`,
            [created!.id]
        );
        expect(row).toBeDefined();
        expect(Number(row?.is_active)).toBe(0);
    });

    it("rejects cross-school access", async () => {
        const foreign = await schoolB.addFaculty();
        expectError(
            await api.get(schoolA.admin.identity, `/api/faculties/${foreign.id}`),
            403,
            "cross-school violation"
        );
        expectError(
            await api
                .put(schoolA.admin.identity, `/api/faculties/${foreign.id}`)
                .send({ first_name: "Hijack" }),
            403
        );
    });

    it("blocks faculty and students from managing faculty records", async () => {
        expectError(
            await api
                .post(adviser.identity, "/api/faculties")
                .send(facultyPayload(`denied-${RUN_ID}@test.local`)),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.delete(adviser.identity, `/api/faculties/${adviser.id}`),
            403
        );
    });
});
