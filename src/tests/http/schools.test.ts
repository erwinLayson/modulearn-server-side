import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { api, expectError, expectSuccess, loginRequest } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture, createSuperAdmin } from "../helpers/fixtures.js";
import type { TestSchool, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let school: TestSchool;
let superAdmin: TestUser;
const registeredSchoolIds: number[] = [];

const registrationPayload = (
    schoolId: number,
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    school_id: schoolId,
    school_name: `Registered ${RUN_ID}-${schoolId}`,
    school_email: `registered-${schoolId}-${RUN_ID}@test.local`,
    school_level: "1",
    address: "123 Test Street",
    region: "Region",
    province: "Province",
    city: "City",
    contact_number: "000-0000",
    school_logo: "logo.png",
    school_admin: "Owner Name",
    academic_system: "quarter",
    period_count: 4,
    ...overrides,
});

const count = async (sql: string, params: (string | number)[] = []) => {
    const [rows] = await connection!.execute(sql, params);
    return Number((rows as { cnt: number }[])[0]?.cnt ?? 0);
};

const firstRow = async <T>(sql: string, params: (string | number)[]): Promise<T | undefined> => {
    const [rows] = await connection!.execute(sql, params);
    return (rows as T[])[0];
};

describe("school administration", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        school = await createSchoolFixture(connection);
        superAdmin = await createSuperAdmin(connection);
    });

    afterAll(async () => {
        if (!connection) return;
        try {
            await cleanupTestData(connection, {
                schoolIds: [school.schoolId, ...registeredSchoolIds],
                userIds: [superAdmin.id],
            });
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    it("serves a public school list with only id and name", async () => {
        const res = await api.anonymousGet("/api/schools/list");
        const body = expectSuccess(res);
        const rows = body.data as { school_id: number; school_name: string }[];
        const row = rows.find((entry) => entry.school_id === school.schoolId);

        expect(row).toBeDefined();
        expect(Object.keys(row!).sort()).toEqual(["school_id", "school_name"]);
    });

    it("registers a school with its admin, years and periods", async () => {
        const schoolId = 950_000_001;
        registeredSchoolIds.push(schoolId);

        const res = await api
            .anonymousPost("/api/schools")
            .send(registrationPayload(schoolId));
        expectSuccess(res, 201);

        const schoolRow = await firstRow<{
            academic_system: string;
            period_count: number;
            academic_config_completed: number;
        }>(
            `SELECT academic_system, period_count, academic_config_completed FROM schools WHERE school_id = ?`,
            [schoolId]
        );
        expect(schoolRow).toEqual({
            academic_system: "quarter",
            period_count: 4,
            academic_config_completed: 1,
        });

        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM users WHERE school_id = ? AND role = 'school_admin'`,
                [schoolId]
            )
        ).toBe(1);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_admins WHERE school_id = ?`, [schoolId])
        ).toBe(1);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ?`, [schoolId])
        ).toBe(2);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM academic_periods WHERE school_id = ?`, [schoolId])
        ).toBe(4);
    });

    it("falls back to quarter/4 for invalid academic configuration", async () => {
        const schoolId = 950_000_002;
        registeredSchoolIds.push(schoolId);

        const res = await api
            .anonymousPost("/api/schools")
            .send(registrationPayload(schoolId, { academic_system: "trimester", period_count: 99 }));
        expectSuccess(res, 201);

        const row = await firstRow<{ academic_system: string; period_count: number }>(
            `SELECT academic_system, period_count FROM schools WHERE school_id = ?`,
            [schoolId]
        );
        expect(row).toEqual({ academic_system: "quarter", period_count: 4 });
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM academic_periods WHERE school_id = ?`, [schoolId])
        ).toBe(4);
    });

    it("rejects a registration with missing fields", async () => {
        const res = await api.anonymousPost("/api/schools").send({});
        expectError(res, 400, "Invalid data:");

        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM schools WHERE school_name LIKE 'Registered ${RUN_ID}%'`
            )
        ).toBe(2);
    });

    it("rolls back when the school email already exists", async () => {
        const duplicateId = 950_000_003;
        const res = await api.anonymousPost("/api/schools").send(
            registrationPayload(duplicateId, {
                school_email: `school-${school.schoolId}@test.local`,
            })
        );
        expectError(res, 409);

        expect(
            await count(`SELECT COUNT(*) AS cnt FROM users WHERE school_id = ?`, [duplicateId])
        ).toBe(0);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM schools WHERE school_id = ?`, [duplicateId])
        ).toBe(0);
    });

    it("lists all schools for the super admin only", async () => {
        const allowed = await api.get(superAdmin.identity, "/api/schools");
        const body = expectSuccess(allowed);
        expect(
            (body.data as { school_id: number }[]).some((row) => row.school_id === school.schoolId)
        ).toBe(true);

        const denied = await api.get(school.admin.identity, "/api/schools");
        expectError(denied, 403, "Insufficient permissions");
    });

    it("returns the school configuration", async () => {
        const res = await api.get(
            school.admin.identity,
            `/api/schools/${school.schoolId}/config`
        );
        const body = expectSuccess(res);
        expect(body.data).toMatchObject({
            school_id: school.schoolId,
            academic_system: "quarter",
            period_count: 4,
        });
    });

    it("updates the school configuration and validates it", async () => {
        const update = await api
            .put(school.admin.identity, `/api/schools/${school.schoolId}/config`)
            .send({ academic_system: "semester", period_count: 2 });
        expectSuccess(update);

        const config = expectSuccess(
            await api.get(school.admin.identity, `/api/schools/${school.schoolId}/config`)
        );
        expect(config.data).toMatchObject({ academic_system: "semester", period_count: 2 });

        expectError(
            await api
                .put(school.admin.identity, `/api/schools/${school.schoolId}/config`)
                .send({ academic_system: "trimester" }),
            400,
            "Invalid academic system"
        );
        expectError(
            await api
                .put(school.admin.identity, `/api/schools/${school.schoolId}/config`)
                .send({ period_count: 7 }),
            400,
            "Period count must be between 1 and 6"
        );
    });

    it("lets the registered admin log in and read their config", async () => {
        const schoolId = 950_000_004;
        registeredSchoolIds.push(schoolId);

        expectSuccess(
            await api.anonymousPost("/api/schools").send(registrationPayload(schoolId)),
            201
        );

        const admin = await firstRow<{ email: string }>(
            `SELECT email FROM users WHERE school_id = ? AND role = 'school_admin'`,
            [schoolId]
        );
        expect(admin?.email).toBe(`registered-${schoolId}-${RUN_ID}@test.local`);

        const login = await loginRequest(
            admin!.email,
            process.env.ADMIN_DEFAULT_PASSWORD as string,
            schoolId
        );
        const loginBody = expectSuccess(login);
        expect(loginBody.data.user).toMatchObject({ role: "school_admin", school_id: schoolId });

        expectSuccess(
            await api.get(
                {
                    id: loginBody.data.user.id,
                    role: "school_admin",
                    school_id: schoolId,
                },
                `/api/schools/${schoolId}/config`
            )
        );
    });
});
