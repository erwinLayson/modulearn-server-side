import type { PoolConnection } from "mysql2/promise";
import type { Response } from "supertest";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import { RUN_ID, createSchoolFixture } from "../helpers/fixtures.js";
import type { TestFaculty, TestSchool, TestStudent } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let school: TestSchool;
let faculty: TestFaculty;
let existingStudent: TestStudent;

const CSV_CONTENT_TYPE = "text/csv";
const XLSX_CONTENT_TYPE =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const previewRequest = (csv: string) =>
    api
        .post(school.admin.identity, "/api/students/import/preview")
        .attach("file", Buffer.from(csv), {
            filename: "students.csv",
            contentType: CSV_CONTENT_TYPE,
        });

const importRequest = (csv: string) =>
    api.post(school.admin.identity, "/api/students/import").attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: CSV_CONTENT_TYPE,
    });

const count = async (sql: string, params: (string | number)[] = []) => {
    const [rows] = await connection!.execute(sql, params);
    return Number((rows as { cnt: number }[])[0]?.cnt ?? 0);
};

describe("student import", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        school = await createSchoolFixture(connection);
        faculty = await school.addFaculty();
        existingStudent = await school.addStudent();
    });

    afterAll(async () => {
        if (!connection) return;
        try {
            await cleanupTestData(connection, { schoolIds: [school.schoolId] });
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    it("previews a valid CSV without inserting anything", async () => {
        const csv = [
            "first_name,last_name,email,sex",
            `Preview,One,preview-one-${RUN_ID}@test.local,male`,
            `Preview,Two,preview-two-${RUN_ID}@test.local,female`,
        ].join("\n");

        const res = await previewRequest(csv);
        const body = expectSuccess(res);

        expect(body.data.totalRows).toBe(2);
        expect(body.data.validRows).toBe(2);
        expect(body.data.validationErrors).toEqual([]);
        expect(body.data.previewData).toHaveLength(2);
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM students WHERE email LIKE ?`, [
                `preview-%${RUN_ID}@test.local`,
            ])
        ).toBe(0);
    });

    it("maps aliased headers and reports unknown columns", async () => {
        const csv = [
            "First Name,Last Name,Email,Gender,Favorite Color",
            `Alias,Person,alias-${RUN_ID}@test.local,female,blue`,
        ].join("\n");

        const res = await previewRequest(csv);
        const body = expectSuccess(res);

        expect(body.data.validRows).toBe(1);
        expect(body.data.columnMapping["First Name"]).toBe("first_name");
        expect(body.data.columnMapping["Last Name"]).toBe("last_name");
        expect(body.data.columnMapping["Gender"]).toBe("sex");
        expect(
            (body.data.warnings as string[]).some((warning) =>
                warning.includes('Unrecognized column ignored: "Favorite Color"')
            )
        ).toBe(true);
    });

    it("reports row-level validation errors with spreadsheet row numbers", async () => {
        const csv = [
            "first_name,last_name,email",
            `OnlyFirst,,missing-last-${RUN_ID}@test.local`,
            "Bad,Email,not-an-email",
        ].join("\n");

        const res = await previewRequest(csv);
        const body = expectSuccess(res);
        const errors = body.data.validationErrors as { row: number; error: string }[];

        expect(body.data.totalRows).toBe(2);
        expect(body.data.validRows).toBe(0);
        expect(errors.map((error) => error.row).sort()).toEqual([2, 3]);
        expect(errors.some((error) => error.error.includes("last_name"))).toBe(true);
        expect(errors.some((error) => error.error.includes("Invalid email format"))).toBe(true);
    });

    it("previews an Excel workbook", async () => {
        const email = `xlsx-${RUN_ID}@test.local`;
        const worksheet = XLSX.utils.json_to_sheet([
            { first_name: "Excel", last_name: "Student", email },
        ]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

        const res = await api
            .post(school.admin.identity, "/api/students/import/preview")
            .attach("file", buffer, {
                filename: "students.xlsx",
                contentType: XLSX_CONTENT_TYPE,
            });

        const body = expectSuccess(res);
        expect(body.data.validRows).toBe(1);
        expect(body.data.previewData[0]).toMatchObject({ first_name: "Excel", email });
    });

    it("rejects a preview without a file", async () => {
        const res = await api.post(school.admin.identity, "/api/students/import/preview");
        expectError(res, 400, "No file uploaded");
    });

    it("imports valid rows and lists them afterwards", async () => {
        const first = `commit-one-${RUN_ID}@test.local`;
        const second = `commit-two-${RUN_ID}@test.local`;
        const csv = [
            "first_name,last_name,email",
            `Commit,One,${first}`,
            `Commit,Two,${second}`,
        ].join("\n");

        const res = await importRequest(csv);
        const body = expectSuccess(res);

        expect(body.data).toMatchObject({ success: 2, failed: 0 });
        expect(
            await count(`SELECT COUNT(*) AS cnt FROM students WHERE email IN (?, ?)`, [first, second])
        ).toBe(2);

        const list = expectSuccess(
            await api.get(school.admin.identity, `/api/students/school/${school.schoolId}`)
        );
        const emails = (list.data as { email: string }[]).map((row) => row.email);
        expect(emails).toEqual(expect.arrayContaining([first, second]));
    });

    it("reports an existing student email as a failed row", async () => {
        const newEmail = `commit-new-${RUN_ID}@test.local`;
        const csv = [
            "first_name,last_name,email",
            `Duplicate,Existing,${existingStudent.email}`,
            `Fresh,Student,${newEmail}`,
        ].join("\n");

        // The import service logs expected per-row failures; keep output readable.
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        let res: Response;
        try {
            res = await importRequest(csv);
        } finally {
            errorLog.mockRestore();
        }
        const body = expectSuccess(res);
        const errors = body.data.errors as { row: number; email?: string; error: string }[];

        expect(body.data.success).toBe(1);
        expect(body.data.failed).toBe(1);
        expect(errors).toHaveLength(1);
        expect(errors[0]?.email).toBe(existingStudent.email);
        expect(errors[0]?.error).toContain("Email already exists in this school");

        expect(
            await count(`SELECT COUNT(*) AS cnt FROM students WHERE email = ?`, [newEmail])
        ).toBe(1);
    });

    it("inserts nothing when every row is invalid", async () => {
        const csv = ["first_name,last_name,email", ",Missing,also-bad"].join("\n");
        const before = await count(`SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`, [
            school.schoolId,
        ]);

        const res = await importRequest(csv);
        const body = expectSuccess(res);

        expect(body.data.success).toBe(0);
        expect(body.data.failed).toBeGreaterThan(0);

        const after = await count(`SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`, [
            school.schoolId,
        ]);
        expect(after).toBe(before);
    });

    it("scopes imports to the caller's school and role", async () => {
        const email = `scoped-${RUN_ID}@test.local`;
        const csv = ["first_name,last_name,email", `Scoped,Student,${email}`].join("\n");

        expectSuccess(await importRequest(csv));

        const [rows] = await connection!.execute(
            `SELECT school_id, admin_id FROM students WHERE email = ?`,
            [email]
        );
        const row = (rows as { school_id: number; admin_id: Buffer }[])[0];
        expect(row?.school_id).toBe(school.schoolId);

        expectError(
            await api
                .post(faculty.identity, "/api/students/import")
                .attach("file", Buffer.from(csv), {
                    filename: "students.csv",
                    contentType: CSV_CONTENT_TYPE,
                }),
            403,
            "Insufficient permissions"
        );
    });
});
