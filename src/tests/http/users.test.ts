import bcrypt from "bcrypt";
import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import {
    RUN_ID,
    createSchoolFixture,
    createSuperAdmin,
} from "../helpers/fixtures.js";
import type { TestFaculty, TestSchool, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let superAdmin: TestUser;
let faculty: TestFaculty;

const userPayload = (
    email: string,
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    email,
    password: "UserPass123!",
    role: "student",
    school_id: schoolA.schoolId,
    status: "active",
    name: "Created User",
    ...overrides,
});

const firstRow = async <T>(sql: string, params: (string | number | Buffer)[]): Promise<T | undefined> => {
    const [rows] = await connection!.execute(sql, params);
    return (rows as T[])[0];
};

describe("super admin user management", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection);
        schoolB = await createSchoolFixture(connection);
        superAdmin = await createSuperAdmin(connection);
        faculty = await schoolA.addFaculty();
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

    it("lists and reads users", async () => {
        const list = expectSuccess(await api.get(superAdmin.identity, "/api/users"));
        const ids = (list.data as { id: string }[]).map((user) => user.id);
        expect(ids).toContain(schoolA.admin.id);
        expect(ids).toContain(superAdmin.id);

        const one = expectSuccess(
            await api.get(superAdmin.identity, `/api/users/${schoolA.admin.id}`)
        );
        expect(one.data).toMatchObject({ role: "school_admin", email: schoolA.admin.email });
    });

    it("returns 404 for an unknown user", async () => {
        expectError(
            await api.get(superAdmin.identity, "/api/users/00000000-0000-0000-0000-000000000000"),
            404,
            "User not found"
        );
    });

    it("creates accounts for each role", async () => {
        const cases = [
            { role: "school_admin", school: schoolA.schoolId },
            { role: "faculty", school: schoolA.schoolId },
            { role: "student", school: schoolA.schoolId },
        ];

        for (const entry of cases) {
            const email = `created-${entry.role}-${RUN_ID}@test.local`;
            expectSuccess(
                await api
                    .post(superAdmin.identity, "/api/users")
                    .send(userPayload(email, { role: entry.role, school_id: entry.school })),
                201
            );

            const row = await firstRow<{ role: string; school_id: number; status: string }>(
                `SELECT role, school_id, status FROM users WHERE email = ?`,
                [email]
            );
            expect(row).toEqual({
                role: entry.role,
                school_id: entry.school,
                status: "active",
            });
        }
    });

    it("requires a school id for a basic user payload", async () => {
        const res = await api
            .post(superAdmin.identity, "/api/users")
            .send(userPayload(`no-school-${RUN_ID}@test.local`, { school_id: undefined }));
        expectError(res, 400, "Invalid data: school_id");
    });

    it("rejects a duplicate email in the same school", async () => {
        const email = `duplicate-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(superAdmin.identity, "/api/users").send(userPayload(email)),
            201
        );

        expectError(
            await api.post(superAdmin.identity, "/api/users").send(userPayload(email)),
            400,
            "Email already exists in this school"
        );
    });

    it("allows the same email in another school", async () => {
        const email = `shared-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(superAdmin.identity, "/api/users").send(userPayload(email)),
            201
        );
        expectSuccess(
            await api
                .post(superAdmin.identity, "/api/users")
                .send(userPayload(email, { school_id: schoolB.schoolId })),
            201
        );
    });

    it("rejects a duplicate super admin", async () => {
        const res = await api
            .post(superAdmin.identity, "/api/users")
            .send(
                userPayload(superAdmin.email, {
                    role: "super_admin",
                    school_id: schoolA.schoolId,
                })
            );
        expectError(res, 400, "Super admin with this email already exists");
    });

    it("updates user fields", async () => {
        const email = `update-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(superAdmin.identity, "/api/users").send(userPayload(email)),
            201
        );

        const created = await firstRow<{ id: Buffer }>(
            `SELECT id FROM users WHERE email = ?`,
            [email]
        );
        const id = created!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        expectSuccess(
            await api
                .put(superAdmin.identity, `/api/users/${id}`)
                .send({ name: "Renamed User", status: "suspended" })
        );

        const updated = await firstRow<{ name: string; status: string }>(
            `SELECT name, status FROM users WHERE id = ?`,
            [created!.id]
        );
        expect(updated).toEqual({ name: "Renamed User", status: "suspended" });
    });

    it("changes another user's password but not its own", async () => {
        const email = `password-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(superAdmin.identity, "/api/users").send(userPayload(email)),
            201
        );

        const created = await firstRow<{ id: Buffer }>(
            `SELECT id FROM users WHERE email = ?`,
            [email]
        );
        const id = created!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        expectSuccess(
            await api
                .put(superAdmin.identity, `/api/users/${id}/password`)
                .send({ new_password: "NewSecret1" })
        );

        const row = await firstRow<{ password: string }>(
            `SELECT password FROM users WHERE id = ?`,
            [created!.id]
        );
        expect(await bcrypt.compare("NewSecret1", row!.password)).toBe(true);

        expectError(
            await api
                .put(superAdmin.identity, `/api/users/${superAdmin.id}/password`)
                .send({ new_password: "NewSecret1" }),
            400,
            "Use your account settings"
        );

        expectError(
            await api
                .put(superAdmin.identity, `/api/users/${id}/password`)
                .send({ new_password: "abc" }),
            400,
            "Password must be at least 6 characters"
        );
    });

    it("deletes a user", async () => {
        const email = `delete-${RUN_ID}@test.local`;
        expectSuccess(
            await api.post(superAdmin.identity, "/api/users").send(userPayload(email)),
            201
        );

        const created = await firstRow<{ id: Buffer }>(
            `SELECT id FROM users WHERE email = ?`,
            [email]
        );
        const id = created!.id.toString("hex").replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        );

        expectSuccess(await api.delete(superAdmin.identity, `/api/users/${id}`));
        expectError(await api.get(superAdmin.identity, `/api/users/${id}`), 404);
    });

    it("rejects non-super-admin roles and anonymous requests", async () => {
        expectError(await api.get(faculty.identity, "/api/users"), 403, "Insufficient permissions");
        expectError(await api.anonymousGet("/api/users"), 401, "No token provided");
        expectError(
            await api.post(faculty.identity, "/api/users").send(userPayload(`denied-${RUN_ID}@test.local`)),
            403
        );
    });
});
