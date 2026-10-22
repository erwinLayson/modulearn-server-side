import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { api, expectError, expectSuccess, loginRequest } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture } from "../helpers/fixtures.js";
import type { TestFaculty, TestSchool } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let faculty: TestFaculty;

const firstRow = async <T>(sql: string, params: (string | number | Buffer)[]): Promise<T | undefined> => {
    const [rows] = await connection!.execute(sql, params);
    return (rows as T[])[0];
};

const defaultPassword = (): string => process.env.USER_DEFAULT_PASSWORD as string;

const studentPayload = (email: string, overrides: Record<string, unknown> = {}) => ({
    first_name: "New",
    last_name: "Student",
    email,
    ...overrides,
});

const userId = async (email: string): Promise<string> => {
    const row = await firstRow<{ id: Buffer }>(`SELECT id FROM students WHERE email = ?`, [email]);
    return row!.id.toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
};

describe("student administration", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection);
        schoolB = await createSchoolFixture(connection);
        faculty = await schoolA.addFaculty();
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

    it("registers a student with documented defaults and a working login", async () => {
        const email = `student-new-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(email)),
            201
        );

        const row = await firstRow<{
            middle_name: string;
            sex: string;
            nationality: string;
            school_id: number;
            admin_id: Buffer;
        }>(
            `SELECT middle_name, sex, nationality, school_id, admin_id FROM students WHERE email = ?`,
            [email]
        );

        expect(row).toMatchObject({
            middle_name: "",
            sex: "male",
            nationality: "Filipino",
            school_id: schoolA.schoolId,
        });
        expect(bufferToUUID(row!.admin_id)).toBe(schoolA.admin.id);

        const account = await firstRow<{ role: string }>(`SELECT role FROM users WHERE email = ?`, [
            email,
        ]);
        expect(account?.role).toBe("student");

        const login = await loginRequest(email, defaultPassword(), schoolA.schoolId);
        const body = expectSuccess(login);
        expect(body.data.user).toMatchObject({ role: "student", first_name: "New" });
    });

    it("requires the first name, last name and email", async () => {
        const cases: [Record<string, unknown>, string][] = [
            [{ last_name: "X", email: `a-${RUN_ID}@test.local` }, "Invalid data: first_name"],
            [{ first_name: "X", email: `b-${RUN_ID}@test.local` }, "Invalid data: last_name"],
            [{ first_name: "X", last_name: "Y" }, "Invalid data: email"],
        ];

        for (const [body, message] of cases) {
            expectError(
                await api.post(schoolA.admin.identity, "/api/students").send(body),
                400,
                message
            );
        }
    });

    it("rejects a duplicate email in the same school and allows another school", async () => {
        const email = `student-dup-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(email)),
            201
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(email)),
            400,
            "Email already exists in this school"
        );
        expectSuccess(
            await api.post(schoolB.admin.identity, "/api/students").send(studentPayload(email)),
            201
        );
    });

    it("lists and reads students", async () => {
        const email = `student-read-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(email)),
            201
        );

        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/students/school/${schoolA.schoolId}`)
        );
        const row = (list.data as { email: string; id: string }[]).find(
            (entry) => entry.email === email
        );
        expect(row).toBeDefined();

        const one = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/students/${row!.id}`)
        );
        expect(one.data).toMatchObject({ id: row!.id, email });

        // verifyOwnership answers unknown ids with 403 before the service runs.
        expectError(
            await api.get(
                schoolA.admin.identity,
                "/api/students/00000000-0000-0000-0000-000000000000"
            ),
            403,
            "Resource not found"
        );
    });

    it("updates a student and syncs the login email", async () => {
        const original = `student-edit-${RUN_ID}@test.local`;
        const updated = `student-edited-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(original)),
            201
        );

        const id = await userId(original);
        expectSuccess(
            await api
                .put(schoolA.admin.identity, `/api/students/${id}`)
                .send({ first_name: "Renamed", email: updated, contact_number: "0911" })
        );

        const profile = await firstRow<{ first_name: string; email: string }>(
            `SELECT first_name, email FROM students WHERE id = ?`,
            [Buffer.from(id.replace(/-/g, ""), "hex")]
        );
        expect(profile).toEqual({ first_name: "Renamed", email: updated });

        const account = await firstRow<{ email: string }>(
            `SELECT email FROM users WHERE id = ?`,
            [Buffer.from(id.replace(/-/g, ""), "hex")]
        );
        expect(account?.email).toBe(updated);

        expectSuccess(await loginRequest(updated, defaultPassword(), schoolA.schoolId));
    });

    it("rejects an email that already belongs to another student", async () => {
        const first = `student-one-${RUN_ID}@test.local`;
        const second = `student-two-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(first)),
            201
        );
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(second)),
            201
        );

        const secondId = await userId(second);
        expectError(
            await api
                .put(schoolA.admin.identity, `/api/students/${secondId}`)
                .send({ email: first }),
            409,
            "A student with this email already exists in this school."
        );
    });

    it("deletes a student", async () => {
        const email = `student-delete-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(schoolA.admin.identity, "/api/students").send(studentPayload(email)),
            201
        );

        const id = await userId(email);
        expectSuccess(await api.delete(schoolA.admin.identity, `/api/students/${id}`));
        expectError(
            await api.get(schoolA.admin.identity, `/api/students/${id}`),
            403,
            "Resource not found"
        );

        const list = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/students/school/${schoolA.schoolId}`)
        );
        expect((list.data as { email: string }[]).some((entry) => entry.email === email)).toBe(false);
    });

    it("blocks faculty from managing students", async () => {
        expectError(
            await api
                .post(faculty.identity, "/api/students")
                .send(studentPayload(`denied-${RUN_ID}@test.local`)),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.delete(faculty.identity, "/api/students/00000000-0000-0000-0000-000000000000"),
            403
        );
    });

    it("keeps student reads school-scoped", async () => {
        const foreign = await schoolB.addStudent();
        expectError(
            await api.get(schoolA.admin.identity, `/api/students/${foreign.id}`),
            403,
            "cross-school violation"
        );
    });
});
