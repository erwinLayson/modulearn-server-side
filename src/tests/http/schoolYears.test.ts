import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture, createSuperAdmin } from "../helpers/fixtures.js";
import type { TestSchool, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let superAdmin: TestUser;

const yearPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    name: `Year ${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`,
    start_date: "2030-06-01",
    end_date: "2031-05-31",
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

describe("school years", () => {
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

    it("creates a school year for the token's school and ignores a spoofed school id", async () => {
        const payload = yearPayload({ school_id: schoolB.schoolId, name: `Created ${RUN_ID}` });

        expectSuccess(await api.post(schoolA.admin.identity, "/api/school-years").send(payload), 201);

        const row = await firstRow<{ school_id: number; start_date: string; end_date: string }>(
            `SELECT school_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
                    DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
             FROM school_years WHERE name = ?`,
            [payload.name as string]
        );
        expect(row).toMatchObject({
            school_id: schoolA.schoolId,
            start_date: "2030-06-01",
            end_date: "2031-05-31",
        });
    });

    it("requires a name and both dates", async () => {
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/school-years")
                .send(yearPayload({ name: "  " })),
            400,
            "Invalid data: name"
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/school-years")
                .send(yearPayload({ start_date: undefined })),
            400,
            "Invalid data: start_date"
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/school-years")
                .send(yearPayload({ end_date: undefined })),
            400,
            "Invalid data: end_date"
        );
    });

    it("rejects a duplicate year name in the same school and allows it elsewhere", async () => {
        const name = `Duplicate ${RUN_ID}`;
        const payload = yearPayload({ name });

        expectSuccess(await api.post(schoolA.admin.identity, "/api/school-years").send(payload), 201);
        expectError(
            await api.post(schoolA.admin.identity, "/api/school-years").send(payload),
            409,
            "already exists"
        );
        expectSuccess(await api.post(schoolB.admin.identity, "/api/school-years").send(payload), 201);
    });

    it("lists only the token school's years, newest first", async () => {
        await schoolA.addSchoolYear({ name: `Older ${RUN_ID}`, startDate: "2023-06-01" });
        await schoolA.addSchoolYear({ name: `Newer ${RUN_ID}`, startDate: "2025-06-01" });
        await schoolB.addSchoolYear({ name: `Other ${RUN_ID}`, startDate: "2025-06-01" });

        // The URL school id is overridden by the token's school.
        const body = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/school-years/school/${schoolB.schoolId}`)
        );
        expect(body.data.every((y: { school_id: number }) => y.school_id === schoolA.schoolId)).toBe(
            true
        );

        const startDates = body.data.map((y: { start_date: string }) =>
            String(y.start_date).slice(0, 10)
        );
        expect(startDates).toEqual([...startDates].sort().reverse());
        expect(body.data.map((y: { name: string }) => y.name)).not.toContain(`Other ${RUN_ID}`);
    });

    it("returns the current school year for the token's school", async () => {
        const body = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/school-years/current/${schoolB.schoolId}`)
        );
        expect(body.data).toMatchObject({
            id: schoolA.currentSchoolYear.id,
            name: schoolA.currentSchoolYear.name,
            school_id: schoolA.schoolId,
            is_current: 1,
        });
    });

    it("returns a school year by id for a super admin", async () => {
        const body = expectSuccess(
            await api.get(superAdmin.identity, `/api/school-years/${schoolA.currentSchoolYear.id}`)
        );
        expect(body.data).toMatchObject({
            id: schoolA.currentSchoolYear.id,
            name: schoolA.currentSchoolYear.name,
            school_id: schoolA.schoolId,
        });
    });

    it("auto-generate returns the existing current year without creating duplicates", async () => {
        const before = await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ?`, [
            schoolA.schoolId,
        ]);

        const body = expectSuccess(
            await api.post(
                schoolA.admin.identity,
                `/api/school-years/auto-generate/${schoolB.schoolId}`
            )
        );
        expect(body.data).toMatchObject({ id: schoolA.currentSchoolYear.id });

        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ?`, [
                schoolA.schoolId,
            ])
        ).toBe(before);
    });

    it("auto-generate creates the current and next year when none is current", async () => {
        await connection!.execute(`UPDATE school_years SET is_current = 0 WHERE school_id = ?`, [
            schoolA.schoolId,
        ]);
        const before = await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ?`, [
            schoolA.schoolId,
        ]);

        const body = expectSuccess(
            await api.post(
                schoolA.admin.identity,
                `/api/school-years/auto-generate/${schoolA.schoolId}`
            )
        );
        expect(body.data).toMatchObject({ school_id: schoolA.schoolId, is_current: 1 });

        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ?`, [
                schoolA.schoolId,
            ])
        ).toBe(before + 2);
        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ? AND is_current = 1`,
                [schoolA.schoolId]
            )
        ).toBe(1);

        const generated = await firstRow<{ name: string; start_date: string; end_date: string }>(
            `SELECT name, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
                    DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
             FROM school_years WHERE school_id = ? AND is_current = 1`,
            [schoolA.schoolId]
        );
        expect(generated!.name).toMatch(/^\d{4}-\d{4}$/);
        expect(generated!.start_date.slice(5)).toBe("06-01");
        expect(generated!.end_date.slice(5)).toBe("05-31");

        // A second call keeps the generated current year.
        const again = expectSuccess(
            await api.post(
                schoolA.admin.identity,
                `/api/school-years/auto-generate/${schoolA.schoolId}`
            )
        );
        expect(again.data).toMatchObject({ id: body.data.id });
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ?`, [
                schoolA.schoolId,
            ])
        ).toBe(before + 2);
    });

    it("reads a school year by its numeric id and denies another school's year", async () => {
        const body = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/school-years/${schoolA.currentSchoolYear.id}`)
        );
        expect(body.data).toMatchObject({
            id: schoolA.currentSchoolYear.id,
            name: schoolA.currentSchoolYear.name,
            school_id: schoolA.schoolId,
        });

        expectError(
            await api.get(
                schoolA.admin.identity,
                `/api/school-years/${schoolB.currentSchoolYear.id}`
            ),
            403,
            "Access denied: cross-school violation"
        );
        expectError(
            await api.get(schoolA.admin.identity, "/api/school-years/99999999"),
            403,
            "Resource not found"
        );
    });

    it("sets the current year and clears the previous one", async () => {
        const previous = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/school-years/current/${schoolA.schoolId}`)
        );
        const year = await schoolA.addSchoolYear({ name: `Switch ${RUN_ID}` });

        expectSuccess(
            await api.put(schoolA.admin.identity, `/api/school-years/${year.id}/set-current`)
        );

        const current = expectSuccess(
            await api.get(schoolA.admin.identity, `/api/school-years/current/${schoolA.schoolId}`)
        );
        expect(current.data).toMatchObject({ id: year.id, is_current: 1 });
        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM school_years WHERE school_id = ? AND is_current = 1`,
                [schoolA.schoolId]
            )
        ).toBe(1);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE id = ? AND is_current = 0`, [
                previous.data.id,
            ])
        ).toBe(1);

        expectError(
            await api.put(
                schoolA.admin.identity,
                `/api/school-years/${schoolB.currentSchoolYear.id}/set-current`
            ),
            403,
            "Access denied: cross-school violation"
        );
        const otherSchool = await firstRow<{ is_current: number }>(
            `SELECT is_current FROM school_years WHERE id = ?`,
            [schoolB.currentSchoolYear.id]
        );
        expect(Number(otherSchool!.is_current)).toBe(1);
    });

    it("deletes an unused year and denies deleting another school's year", async () => {
        const year = await schoolA.addSchoolYear({ name: `Disposable ${RUN_ID}` });

        expectSuccess(await api.delete(schoolA.admin.identity, `/api/school-years/${year.id}`));
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE id = ?`, [year.id])
        ).toBe(0);

        const protectedYear = await schoolB.addSchoolYear({ name: `Protected ${RUN_ID}` });
        expectError(
            await api.delete(schoolA.admin.identity, `/api/school-years/${protectedYear.id}`),
            403,
            "Access denied: cross-school violation"
        );
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM school_years WHERE id = ?`, [
                protectedYear.id,
            ])
        ).toBe(1);
    });

    it("denies school year writes to faculty and super admins", async () => {
        const teacher = await schoolA.addFaculty();

        expectError(
            await api.post(teacher.identity, "/api/school-years").send(yearPayload()),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.post(
                teacher.identity,
                `/api/school-years/auto-generate/${schoolA.schoolId}`
            ),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.post(superAdmin.identity, "/api/school-years").send(yearPayload()),
            403,
            "Insufficient permissions"
        );
    });
});
