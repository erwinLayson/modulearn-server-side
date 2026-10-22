import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateRandomUUID } from "../../helper/generateRandomId.js";
import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { api, expectError, expectSuccess } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import {
    RUN_ID,
    createSchoolFixture,
    createSuperAdmin,
} from "../helpers/fixtures.js";
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
let facultyAdviser: TestFaculty;
let facultyNonAdviser: TestFaculty;
let facultyB: TestFaculty;
let studentA: TestStudent;
let studentB: TestStudent;
let subjectA: TestSubject;
let subjectB: TestSubject;
let classA: TestClass;
let classB: TestClass;
let superAdmin: TestUser;

describe("school data isolation", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection, { name: `Scope A ${RUN_ID}` });
        schoolB = await createSchoolFixture(connection, { name: `Scope B ${RUN_ID}` });

        facultyAdviser = await schoolA.addFaculty();
        facultyNonAdviser = await schoolA.addFaculty();
        facultyB = await schoolB.addFaculty();
        studentA = await schoolA.addStudent();
        studentB = await schoolB.addStudent();
        subjectA = await schoolA.addSubject();
        subjectB = await schoolB.addSubject();

        classA = await schoolA.addClass({ adviserId: facultyAdviser.id });
        classB = await schoolB.addClass({ adviserId: facultyB.id });

        await schoolA.assignFacultyToClass(classA, facultyAdviser, subjectA);
        await schoolA.assignFacultyToClass(classA, facultyNonAdviser, subjectA);
        await schoolB.assignFacultyToClass(classB, facultyB, subjectB);

        await schoolA.enroll(studentA, classA, [subjectA]);
        await schoolB.enroll(studentB, classB, [subjectB]);

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

    it("overrides a forged body school_id on writes", async () => {
        const email = `forged-${RUN_ID}@test.local`;

        const res = await api.post(schoolA.admin.identity, "/api/students").send({
            first_name: "Scope",
            last_name: "Probe",
            email,
            school_id: schoolB.schoolId,
            admin_id: schoolB.admin.id,
        });
        expectSuccess(res, 201);

        const [rows] = await connection!.execute(
            `SELECT school_id, admin_id FROM students WHERE email = ?`,
            [email]
        );
        const row = (rows as { school_id: number; admin_id: Buffer }[])[0];

        expect(row?.school_id).toBe(schoolA.schoolId);
        expect(row ? bufferToUUID(row.admin_id) : null).toBe(schoolA.admin.id);
    });

    it("overrides the :school_id path parameter for the school admin", async () => {
        const res = await api.get(
            schoolA.admin.identity,
            `/api/students/school/${schoolB.schoolId}`
        );
        const body = expectSuccess(res);
        const ids = (body.data as { id: string }[]).map((entry) => entry.id);

        expect(ids).toContain(studentA.id);
        expect(ids).not.toContain(studentB.id);
    });

    it("lets a super admin read another school through the same parameter", async () => {
        const res = await api.get(
            superAdmin.identity,
            `/api/students/school/${schoolB.schoolId}`
        );
        const body = expectSuccess(res);
        const ids = (body.data as { id: string }[]).map((entry) => entry.id);

        expect(ids).toContain(studentB.id);
        expect(ids).not.toContain(studentA.id);
    });

    it("rejects cross-school resource access", async () => {
        const res = await api.get(schoolA.admin.identity, `/api/students/${studentB.id}`);
        expectError(res, 403, "cross-school violation");
    });

    it("reports unknown resources as not accessible", async () => {
        const missing = bufferToUUID(generateRandomUUID());
        const res = await api.get(schoolA.admin.identity, `/api/students/${missing}`);
        expectError(res, 403, "Resource not found");
    });

    it("lets a super admin bypass ownership checks", async () => {
        const res = await api.get(superAdmin.identity, `/api/students/${studentB.id}`);
        expectSuccess(res);
    });

    it("checks numeric school-scoped resources", async () => {
        const own = await api.get(
            schoolA.admin.identity,
            `/api/schools/${schoolA.schoolId}/config`
        );
        const body = expectSuccess(own);
        expect(body.data).toMatchObject({ school_id: schoolA.schoolId });

        const foreign = await api.get(
            schoolA.admin.identity,
            `/api/schools/${schoolB.schoolId}/config`
        );
        expectError(foreign, 403, "cross-school violation");
    });

    it("allows the adviser of an enrolled student to read the academic record", async () => {
        const res = await api.get(
            facultyAdviser.identity,
            `/api/students/${studentA.id}/academic-record`
        );
        expectSuccess(res);
    });

    it("rejects a faculty member who teaches the class but is not its adviser", async () => {
        const res = await api.get(
            facultyNonAdviser.identity,
            `/api/students/${studentA.id}/academic-record`
        );
        expectError(res, 403, "not the adviser");
    });

    it("rejects students from reading academic records", async () => {
        const res = await api.get(
            studentA.identity,
            `/api/students/${studentA.id}/academic-record`
        );
        expectError(res, 403);
    });

    it("rejects cross-school faculty access", async () => {
        const res = await api.get(
            facultyB.identity,
            `/api/students/${studentA.id}/academic-record`
        );
        expectError(res, 403, "cross-school violation");
    });

    it("rejects cross-school single-resource reads", async () => {
        const res = await api.get(schoolA.admin.identity, `/api/faculties/${facultyB.id}`);
        expectError(res, 403, "cross-school violation");
    });

    it("scopes school lists to the token's school", async () => {
        const res = await api.get(
            schoolA.admin.identity,
            `/api/faculties/school/${schoolB.schoolId}`
        );
        const body = expectSuccess(res);
        const ids = (body.data as { id: string }[]).map((entry) => entry.id);

        expect(ids).toContain(facultyAdviser.id);
        expect(ids).not.toContain(facultyB.id);
    });
});
