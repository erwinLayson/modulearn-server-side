import request from "supertest";
import jwt from "jsonwebtoken";
import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { getEnvName } from "../../helper/getEnv.js";
import { api, cookieFor, expectError, expectSuccess, findTokenCookie, loginRequest } from "../helpers/api.js";
import { cleanupTestData } from "../helpers/cleanup.js";
import { connectForTest } from "../helpers/db.js";
import {
    RUN_ID,
    TEST_PASSWORD,
    createSchoolFixture,
    createSuperAdmin,
} from "../helpers/fixtures.js";
import type { TestFaculty, TestSchool, TestStudent, TestUser } from "../helpers/fixtures.js";

let connection: PoolConnection | undefined;
let school: TestSchool;
let faculty: TestFaculty;
let inactiveFaculty: TestFaculty;
let student: TestStudent;
let passwordChanger: TestFaculty;
let emailChanger: TestStudent;
let superAdmin: TestUser;

const cleanupIds = (): { schoolIds: number[]; userIds: string[] } => ({
    schoolIds: school ? [school.schoolId] : [],
    userIds: superAdmin ? [superAdmin.id] : [],
});

describe("authentication and sessions", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        school = await createSchoolFixture(connection);
        faculty = await school.addFaculty();
        inactiveFaculty = await school.addFaculty({ status: "inactive" });
        student = await school.addStudent();
        passwordChanger = await school.addFaculty();
        emailChanger = await school.addStudent();
        superAdmin = await createSuperAdmin(connection);
    });

    afterAll(async () => {
        if (!connection) return;
        try {
            await cleanupTestData(connection, cleanupIds());
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    it("logs in a school admin and sets an HttpOnly token cookie", async () => {
        const res = await loginRequest(school.admin.email, school.admin.password, school.schoolId);
        const body = expectSuccess(res);

        expect(body.data.user).toMatchObject({
            id: school.admin.id,
            role: "school_admin",
            school_id: school.schoolId,
        });
        expect(body.data.user.school_name).toBeTruthy();

        const cookie = findTokenCookie(res);
        expect(cookie).toBeDefined();
        expect(cookie?.toLowerCase()).toContain("httponly");
    });

    it("normalizes the email before lookup", async () => {
        const res = await loginRequest(
            `  ${school.admin.email.toUpperCase()}  `,
            school.admin.password,
            school.schoolId
        );
        expectSuccess(res);
    });

    it("returns a role-specific profile", async () => {
        const facultyRes = expectSuccess(
            await loginRequest(faculty.email, faculty.password, school.schoolId)
        );
        expect(facultyRes.data.user).toMatchObject({
            role: "faculty",
            first_name: faculty.firstName,
        });

        const studentRes = expectSuccess(
            await loginRequest(student.email, student.password, school.schoolId)
        );
        expect(studentRes.data.user).toMatchObject({
            role: "student",
            first_name: student.firstName,
        });

        const superRes = expectSuccess(await loginRequest(superAdmin.email, superAdmin.password));
        expect(superRes.data.user).toMatchObject({
            role: "super_admin",
            name: superAdmin.email,
        });
    });

    it("rejects an unknown email", async () => {
        const res = await loginRequest(`nobody-${RUN_ID}@test.local`, "whatever", school.schoolId);
        expectError(res, 404, "User not found in selected school");
    });

    it("rejects an account from another school", async () => {
        const res = await loginRequest(
            school.admin.email,
            school.admin.password,
            school.schoolId + 7919
        );
        expectError(res, 404);
    });

    it("rejects a wrong password", async () => {
        const res = await loginRequest(school.admin.email, "wrong-password", school.schoolId);
        expectError(res, 400, "Incorrect password");
    });

    it("rejects an inactive account", async () => {
        const res = await loginRequest(
            inactiveFaculty.email,
            inactiveFaculty.password,
            school.schoolId
        );
        expectError(res, 401, "Account is inactive");
    });

    it("rejects missing credentials", async () => {
        const res = await request(app).post("/api/auth/login").send({});
        expectError(res, 400, "Invalid data: email");
    });

    it("updates the password through the credentials endpoint", async () => {
        const newPassword = "ChangedPass456!";

        expectSuccess(
            await api.put(passwordChanger.identity, "/api/auth/credentials").send({
                current_password: TEST_PASSWORD,
                password: newPassword,
            })
        );

        expectError(
            await loginRequest(passwordChanger.email, TEST_PASSWORD, school.schoolId),
            400,
            "Incorrect password"
        );
        expectSuccess(await loginRequest(passwordChanger.email, newPassword, school.schoolId));
    });

    it("updates the email through the credentials endpoint", async () => {
        const newEmail = `changed-${RUN_ID}@test.local`;

        expectSuccess(
            await api.put(emailChanger.identity, "/api/auth/credentials").send({
                current_password: TEST_PASSWORD,
                email: newEmail,
            })
        );

        expectSuccess(await loginRequest(newEmail, TEST_PASSWORD, school.schoolId));
        expectError(
            await loginRequest(emailChanger.email, TEST_PASSWORD, school.schoolId),
            404
        );
    });

    it("rejects a wrong current password", async () => {
        const res = await api.put(school.admin.identity, "/api/auth/credentials").send({
            current_password: "not-the-password",
            password: "AnotherPass789!",
        });
        expectError(res, 400, "Current password is incorrect");
    });

    it("reports nothing to update when no changes are sent", async () => {
        const res = await api.put(school.admin.identity, "/api/auth/credentials").send({
            current_password: TEST_PASSWORD,
        });
        expect(expectSuccess(res).message).toBe("Nothing to update");
    });

    it("logs out by clearing the token cookie", async () => {
        const res = await api.post(school.admin.identity, "/api/logout");
        expectSuccess(res);
        expect(findTokenCookie(res)).toMatch(/^token=;/);
    });

    it("rejects a request without a token", async () => {
        const res = await api.anonymousGet("/api/users");
        expectError(res, 401, "No token provided");
    });

    it("rejects a malformed token", async () => {
        const res = await request(app).get("/api/users").set("Cookie", ["token=not-a-jwt"]);
        expectError(res, 401, "Invalid or expired token");
    });

    it("rejects an expired token", async () => {
        const expired = jwt.sign(
            { id: school.admin.id, role: "school_admin", school_id: school.schoolId },
            getEnvName("JWT_SECRET"),
            { expiresIn: -10 }
        );
        const res = await request(app).get("/api/users").set("Cookie", [`token=${expired}`]);
        expectError(res, 401, "Invalid or expired token");
    });

    it("enforces role permissions", async () => {
        const studentRes = await api.get(student.identity, "/api/users");
        expectError(studentRes, 403, "Insufficient permissions");

        const superRes = await api.get(superAdmin.identity, "/api/users");
        expectSuccess(superRes);
    });

    it("accepts the cookie issued by a real login", async () => {
        const agent = request.agent(app);

        await agent
            .post("/api/auth/login")
            .send({
                email: school.admin.email,
                password: school.admin.password,
                school_id: school.schoolId,
            })
            .expect(200);

        const res = await agent.get(`/api/students/school/${school.schoolId}`);
        expectSuccess(res);
    });

    it("does not accept a cookie signed for another identity", async () => {
        const res = await request(app)
            .get("/api/users")
            .set("Cookie", [cookieFor(student.identity)]);
        expectError(res, 403);
    });
});
