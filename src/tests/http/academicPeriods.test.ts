import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateRandomUUID } from "../../helper/generateRandomId.js";
import { UUIDToBuffer } from "../../helper/UUIDToBuffer.js";
import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture, createSuperAdmin } from "../helpers/fixtures.js";
import type { TestSchool, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let schoolA: TestSchool;
let schoolB: TestSchool;
let superAdmin: TestUser;

const periodPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    school_year_id: schoolA.currentSchoolYear.id,
    name: `Period ${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`,
    period_number: 2,
    start_date: "2024-09-01",
    end_date: "2024-10-31",
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

const createPeriod = async (
    yearId: number,
    body: Record<string, unknown>
): Promise<number> => {
    const res = expectSuccess(
        await api.post(schoolA.admin.identity, "/api/academic-periods").send(
            periodPayload({ school_year_id: yearId, ...body })
        ),
        201
    );
    return Number(res.data.id);
};

describe("academic periods", () => {
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

    it("creates a period for the token's school and ignores a spoofed school id", async () => {
        const year = await schoolA.addSchoolYear({ name: `Create ${RUN_ID}` });
        const payload = periodPayload({
            school_id: schoolB.schoolId,
            school_year_id: year.id,
            name: `Quarter ${RUN_ID}`,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });

        const body = expectSuccess(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(payload),
            201
        );
        expect(typeof body.data.id).toBe("number");

        const row = await firstRow<{
            school_id: number;
            school_year_id: number;
            period_number: number;
            is_current: number;
            start_date: string;
        }>(
            `SELECT school_id, school_year_id, period_number, is_current,
                    DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date
             FROM academic_periods WHERE id = ?`,
            [body.data.id]
        );
        expect(row).toMatchObject({
            school_id: schoolA.schoolId,
            school_year_id: year.id,
            period_number: 1,
            is_current: 0,
            start_date: "2025-06-01",
        });

        const list = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolA.schoolId}/year/${year.id}`
            )
        );
        expect(list.data.map((p: { id: number }) => p.id)).toContain(body.data.id);
    });

    it("validates the name, period number and date order", async () => {
        const year = await schoolA.addSchoolYear({ name: `Validate ${RUN_ID}` });

        expectError(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(
                periodPayload({ school_year_id: year.id, name: "   " })
            ),
            400,
            "Period name is required"
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(
                periodPayload({ school_year_id: year.id, period_number: 0 })
            ),
            400,
            "Period number must be at least 1"
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(
                periodPayload({
                    school_year_id: year.id,
                    start_date: "2025-10-01",
                    end_date: "2025-09-01",
                })
            ),
            400,
            "Start date must be before or equal to end date"
        );

        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM academic_periods WHERE school_id = ? AND school_year_id = ?`,
                [schoolA.schoolId, year.id]
            )
        ).toBe(0);
    });

    it("enforces unique period numbers and names within a school year", async () => {
        const year = await schoolA.addSchoolYear({ name: `Unique ${RUN_ID}` });
        const name = `Quarter One ${RUN_ID}`;
        await createPeriod(year.id, {
            name,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });

        expectError(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(
                periodPayload({
                    school_year_id: year.id,
                    name: `Other ${RUN_ID}`,
                    period_number: 1,
                    start_date: "2025-09-01",
                    end_date: "2025-10-31",
                })
            ),
            400,
            "Period number 1 already exists"
        );
        expectError(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(
                periodPayload({
                    school_year_id: year.id,
                    name,
                    period_number: 2,
                    start_date: "2025-09-01",
                    end_date: "2025-10-31",
                })
            ),
            400,
            `Period name "${name}" already exists`
        );

        // The same name is allowed in a different school year.
        const otherYear = await schoolA.addSchoolYear({ name: `Reuse ${RUN_ID}` });
        await createPeriod(otherYear.id, {
            name,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });
    });

    it("rejects periods whose dates overlap an existing period", async () => {
        const year = await schoolA.addSchoolYear({ name: `Overlap ${RUN_ID}` });
        await createPeriod(year.id, {
            name: `First ${RUN_ID}`,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });

        expectError(
            await api.post(schoolA.admin.identity, "/api/academic-periods").send(
                periodPayload({
                    school_year_id: year.id,
                    name: `Second ${RUN_ID}`,
                    period_number: 2,
                    start_date: "2025-08-15",
                    end_date: "2025-09-30",
                })
            ),
            400,
            "Period dates overlap with an existing period"
        );
    });

    it("lists a school year's periods in period order", async () => {
        const year = await schoolA.addSchoolYear({ name: `List ${RUN_ID}` });
        const second = await createPeriod(year.id, {
            name: `Second ${RUN_ID}`,
            period_number: 2,
            start_date: "2025-09-01",
            end_date: "2025-10-31",
        });
        const first = await createPeriod(year.id, {
            name: `First ${RUN_ID}`,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });

        const body = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolA.schoolId}/year/${year.id}`
            )
        );
        expect(body.data.map((p: { id: number }) => p.id)).toEqual([first, second]);
        expect(body.data.map((p: { period_number: number }) => p.period_number)).toEqual([1, 2]);
    });

    it("returns the current period and lets the school admin switch it", async () => {
        const before = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolA.schoolId}/current`
            )
        );
        expect(before.data).toMatchObject({
            id: schoolA.currentPeriod.id,
            is_current: 1,
            school_year_id: schoolA.currentSchoolYear.id,
        });

        const newPeriod = await createPeriod(schoolA.currentSchoolYear.id, {
            name: `Second Quarter ${RUN_ID}`,
            period_number: 2,
            start_date: "2024-09-01",
            end_date: "2024-10-31",
        });
        expectSuccess(
            await api.put(
                schoolA.admin.identity,
                `/api/academic-periods/${newPeriod}/set-current`
            )
        );

        const after = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolA.schoolId}/current`
            )
        );
        expect(after.data).toMatchObject({ id: newPeriod, is_current: 1 });
        expect(
            await count(
                `SELECT COUNT(*) AS cnt FROM academic_periods
                 WHERE school_id = ? AND school_year_id = ? AND is_current = 1`,
                [schoolA.schoolId, schoolA.currentSchoolYear.id]
            )
        ).toBe(1);

        expectError(
            await api.put(
                schoolA.admin.identity,
                `/api/academic-periods/${schoolB.currentPeriod.id}/set-current`
            ),
            404,
            "Academic period not found"
        );
        expectError(
            await api.put(schoolA.admin.identity, "/api/academic-periods/99999999/set-current"),
            404,
            "Academic period not found"
        );
    });

    it("updates a period and re-checks name uniqueness and overlaps", async () => {
        const year = await schoolA.addSchoolYear({ name: `Update ${RUN_ID}` });
        const first = await createPeriod(year.id, {
            name: `First ${RUN_ID}`,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });
        const second = await createPeriod(year.id, {
            name: `Second ${RUN_ID}`,
            period_number: 2,
            start_date: "2025-09-01",
            end_date: "2025-10-31",
        });

        const renamed = `Renamed ${RUN_ID}`;
        const updated = expectSuccess(
            await api.put(schoolA.admin.identity, `/api/academic-periods/${second}`).send({
                name: renamed,
                start_date: "2025-11-01",
                end_date: "2025-12-31",
            })
        );
        expect(updated.data).toMatchObject({ id: second, name: renamed, period_number: 2 });

        expectError(
            await api.put(schoolA.admin.identity, `/api/academic-periods/${second}`).send({
                start_date: "2025-08-15",
                end_date: "2025-09-15",
            }),
            400,
            "Period dates overlap with an existing period"
        );
        expectError(
            await api.put(schoolA.admin.identity, `/api/academic-periods/${second}`).send({
                name: `First ${RUN_ID}`,
            }),
            400,
            `Period name "First ${RUN_ID}" already exists`
        );
        expectError(
            await api.put(schoolA.admin.identity, `/api/academic-periods/${second}`).send({
                start_date: "2025-12-01",
                end_date: "2025-11-01",
            }),
            400,
            "Start date must be before or equal to end date"
        );
        expectError(
            await api
                .put(schoolA.admin.identity, `/api/academic-periods/${schoolB.currentPeriod.id}`)
                .send({ name: "Cross school" }),
            404,
            "Academic period not found"
        );
        expectError(
            await api
                .put(schoolA.admin.identity, "/api/academic-periods/99999999")
                .send({ name: "Missing" }),
            404,
            "Academic period not found"
        );

        // `first` is intentionally unused beyond setup; keep the assertion explicit.
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM academic_periods WHERE id = ?`, [first])
        ).toBe(1);
    });

    it("deletes an unused period but refuses one with grade items", async () => {
        const year = await schoolA.addSchoolYear({ name: `Delete ${RUN_ID}` });
        const unused = await createPeriod(year.id, {
            name: `Unused ${RUN_ID}`,
            period_number: 1,
            start_date: "2025-06-01",
            end_date: "2025-08-31",
        });
        expectSuccess(
            await api.delete(schoolA.admin.identity, `/api/academic-periods/${unused}`)
        );
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM academic_periods WHERE id = ?`, [unused])
        ).toBe(0);

        const referenced = await createPeriod(year.id, {
            name: `Referenced ${RUN_ID}`,
            period_number: 2,
            start_date: "2025-09-01",
            end_date: "2025-10-31",
        });
        const adviser = await schoolA.addFaculty();
        const classroom = await schoolA.addClass({
            adviserId: adviser.id,
            schoolYearId: year.id,
        });
        const subject = await schoolA.addSubject();
        await connection!.execute(
            `INSERT INTO grade_items (id, class_id, subject_id, period_id, faculty_id, category, title, max_score)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
                generateRandomUUID(),
                UUIDToBuffer(classroom.id),
                UUIDToBuffer(subject.id),
                referenced,
                UUIDToBuffer(adviser.id),
                "quiz",
                `Period item ${RUN_ID}`,
                100,
            ]
        );

        expectError(
            await api.delete(schoolA.admin.identity, `/api/academic-periods/${referenced}`),
            400,
            "Cannot delete this period"
        );
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM academic_periods WHERE id = ?`, [referenced])
        ).toBe(1);
    });

    it("generates missing periods from the school config, idempotently", async () => {
        const year = await schoolA.addSchoolYear({ name: `Generate ${RUN_ID}` });

        const generated = expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/academic-periods/generate")
                .send({ school_year_id: year.id })
        );
        expect(generated.data).toEqual({ generated: 4 });
        expect(generated.message).toContain("Generated 4 period");

        const periods = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolA.schoolId}/year/${year.id}`
            )
        );
        expect(periods.data).toHaveLength(4);
        expect(periods.data.map((p: { period_number: number }) => p.period_number)).toEqual([
            1, 2, 3, 4,
        ]);
        expect(periods.data.map((p: { name: string }) => p.name)).toEqual([
            "Quarter 1",
            "Quarter 2",
            "Quarter 3",
            "Quarter 4",
        ]);
        expect(periods.data[0].is_current).toBe(1);

        const again = expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/academic-periods/generate")
                .send({ school_year_id: year.id })
        );
        expect(again.data).toEqual({ generated: 0 });
        expect(again.message).toContain("All periods already exist");

        expectError(
            await api
                .post(schoolA.admin.identity, "/api/academic-periods/generate")
                .send({ school_year_id: schoolB.currentSchoolYear.id }),
            404,
            "School year not found"
        );
        expectError(
            await api
                .post(schoolA.admin.identity, "/api/academic-periods/generate")
                .send({ school_year_id: 99999999 }),
            404,
            "School year not found"
        );
    });

    it("binds the current period read to the token's school and lets a super admin read any school", async () => {
        const ownCurrent = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolA.schoolId}/current`
            )
        );
        expect(ownCurrent.data).toMatchObject({
            school_id: schoolA.schoolId,
            is_current: 1,
        });

        const forgedPath = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolB.schoolId}/current`
            )
        );
        expect(forgedPath.data).toMatchObject({ school_id: schoolA.schoolId, is_current: 1 });

        const bViaSuper = expectSuccess(
            await api.get(
                superAdmin.identity,
                `/api/academic-periods/school/${schoolB.schoolId}/current`
            )
        );
        expect(bViaSuper.data).toMatchObject({ school_id: schoolB.schoolId, is_current: 1 });
    });

    it("returns 404 when the year does not belong to the token's school", async () => {
        const bYear = schoolB.currentSchoolYear.id;
        expectError(
            await api.get(
                schoolA.admin.identity,
                `/api/academic-periods/school/${schoolB.schoolId}/year/${bYear}`
            ),
            404,
            "School year not found"
        );
    });

    it("denies period writes to faculty, students and super admins", async () => {
        const teacher = await schoolA.addFaculty();
        const student = await schoolA.addStudent();
        const periodId = schoolA.currentPeriod.id;

        expectError(
            await api.post(teacher.identity, "/api/academic-periods").send(periodPayload()),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api
                .put(teacher.identity, `/api/academic-periods/${periodId}`)
                .send({ name: "Nope" }),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.delete(student.identity, `/api/academic-periods/${periodId}`),
            403,
            "Insufficient permissions"
        );
        expectError(
            await api.put(superAdmin.identity, `/api/academic-periods/${periodId}/set-current`),
            403,
            "Insufficient permissions"
        );
    });
});
