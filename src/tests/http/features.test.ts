import type { PoolConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { FEATURE_KEYS } from "../../constant/features.js";
import { requireFeature } from "../../middleware/requireFeature.js";
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
let faculty: TestFaculty;
let student: TestStudent;
let secondStudent: TestStudent;
let subject: TestSubject;
let classroom: TestClass;
let superAdmin: TestUser;

interface FeatureState {
    key: string;
    is_enabled: boolean;
}

const featureBody = (key: string) =>
    api
        .put(superAdmin.identity, `/api/schools/${schoolA.schoolId}/features`)
        .send({ features: [{ key, is_enabled: false }] });

const featureState = (data: { features: FeatureState[] }, key: string): boolean | undefined =>
    data.features.find((feature) => feature.key === key)?.is_enabled;

describe("per-school feature switches", () => {
    beforeAll(async () => {
        connection = await connectForTest();
        schoolA = await createSchoolFixture(connection, { name: `Features A ${RUN_ID}` });
        schoolB = await createSchoolFixture(connection, { name: `Features B ${RUN_ID}` });

        faculty = await schoolA.addFaculty();
        student = await schoolA.addStudent();
        secondStudent = await schoolA.addStudent();
        subject = await schoolA.addSubject();
        classroom = await schoolA.addClass({ adviserId: faculty.id });

        await schoolA.assignFacultyToClass(classroom, faculty, subject);
        await schoolA.enroll(student, classroom, [subject]);

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

    it("returns the full catalog as enabled when no rows exist", async () => {
        const res = await api.get(
            schoolA.admin.identity,
            `/api/schools/${schoolA.schoolId}/features`
        );
        const body = expectSuccess(res);

        expect(body.data.school_id).toBe(schoolA.schoolId);
        expect(body.data.features).toHaveLength(FEATURE_KEYS.length);
        expect(
            (body.data.features as FeatureState[]).map((feature) => feature.key).sort()
        ).toEqual([...FEATURE_KEYS].sort());
        expect(
            (body.data.features as FeatureState[]).every((feature) => feature.is_enabled)
        ).toBe(true);
    });

    it("lets a super admin read another school's switches", async () => {
        const res = await api.get(
            superAdmin.identity,
            `/api/schools/${schoolB.schoolId}/features`
        );
        const body = expectSuccess(res);
        expect(body.data.school_id).toBe(schoolB.schoolId);
    });

    it("rejects a school admin reading another school's switches", async () => {
        const res = await api.get(
            schoolA.admin.identity,
            `/api/schools/${schoolB.schoolId}/features`
        );
        expectError(res, 403, "cross-school violation");
    });

    it("only allows a super admin to update switches", async () => {
        const res = await api
            .put(schoolA.admin.identity, `/api/schools/${schoolA.schoolId}/features`)
            .send({ features: [{ key: "gradebook", is_enabled: false }] });
        expectError(res, 403, "Insufficient permissions");
    });

    it("persists a toggle and reports it back", async () => {
        const update = await featureBody("attendance");
        expectSuccess(update);

        const res = await api.get(
            schoolA.admin.identity,
            `/api/schools/${schoolA.schoolId}/features`
        );
        expect(featureState(expectSuccess(res).data, "attendance")).toBe(false);

        // Restore so later cases start from a fully enabled school.
        expectSuccess(
            await api
                .put(superAdmin.identity, `/api/schools/${schoolA.schoolId}/features`)
                .send({ features: [{ key: "attendance", is_enabled: true }] })
        );
    });

    it("uses the last value when a key is repeated", async () => {
        const res = await api
            .put(superAdmin.identity, `/api/schools/${schoolA.schoolId}/features`)
            .send({
                features: [
                    { key: "gradebook", is_enabled: false },
                    { key: "gradebook", is_enabled: true },
                ],
            });
        expect(featureState(expectSuccess(res).data, "gradebook")).toBe(true);
    });

    it("validates the school and the entries", async () => {
        expectError(
            await api.get(superAdmin.identity, "/api/schools/not-a-number/features"),
            400,
            "Invalid school id"
        );
        expectError(
            await api.get(superAdmin.identity, "/api/schools/987654321/features"),
            404,
            "School not found"
        );
        expectError(
            await api
                .put(superAdmin.identity, `/api/schools/${schoolA.schoolId}/features`)
                .send({ features: [{ key: "telepathy", is_enabled: true }] }),
            400,
            "Unknown feature key"
        );
        expectError(
            await api
                .put(superAdmin.identity, `/api/schools/${schoolA.schoolId}/features`)
                .send({ features: [{ key: "gradebook", is_enabled: "yes" }] }),
            400,
            "is_enabled must be a boolean"
        );
        expectError(
            await api
                .put(superAdmin.identity, `/api/schools/${schoolA.schoolId}/features`)
                .send({ features: [] }),
            400,
            "No features provided"
        );
    });

    it("keeps switches independent per school", async () => {
        expectSuccess(await featureBody("gradebook"));

        const otherRes = await api.get(
            superAdmin.identity,
            `/api/schools/${schoolB.schoolId}/features`
        );
        expect(featureState(expectSuccess(otherRes).data, "gradebook")).toBe(true);

        const ownRes = await api.get(
            schoolA.admin.identity,
            `/api/schools/${schoolA.schoolId}/features`
        );
        expect(featureState(expectSuccess(ownRes).data, "gradebook")).toBe(false);
    });

    it("blocks gradebook routes when the switch is off", async () => {
        await schoolA.setFeature("gradebook", false);
        expectError(
            await api.get(
                faculty.identity,
                `/api/gradebook/items/${classroom.id}/${subject.id}`
            ),
            403,
            "Gradebook is not available for this school"
        );

        await schoolA.setFeature("gradebook", true);
        expectSuccess(
            await api.get(
                faculty.identity,
                `/api/gradebook/items/${classroom.id}/${subject.id}`
            )
        );
    });

    it("blocks attendance routes when the switch is off", async () => {
        await schoolA.setFeature("attendance", false);
        expectError(
            await api
                .get(faculty.identity, `/api/attendance/class/${classroom.id}`)
                .query({ date: "2024-07-01", subject_id: subject.id }),
            403,
            "Attendance is not available for this school"
        );

        await schoolA.setFeature("attendance", true);
        expectSuccess(
            await api
                .get(faculty.identity, `/api/attendance/class/${classroom.id}`)
                .query({ date: "2024-07-01", subject_id: subject.id })
        );
    });

    it("gates attendance reports separately from attendance", async () => {
        await schoolA.setFeature("attendance_reports", false);
        // The base attendance feature stays available.
        expectSuccess(
            await api
                .get(faculty.identity, `/api/attendance/class/${classroom.id}`)
                .query({ date: "2024-07-01", subject_id: subject.id })
        );

        expectError(
            await api.get(
                schoolA.admin.identity,
                `/api/attendance/school/${schoolA.schoolId}/report`
            ),
            403,
            "Classroom attendance reports is not available for this school"
        );

        await schoolA.setFeature("attendance_reports", true);
        expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/attendance/school/${schoolA.schoolId}/report`
            )
        );
    });

    it("blocks the academic record when the switch is off", async () => {
        await schoolA.setFeature("academic_record", false);
        expectError(
            await api.get(
                schoolA.admin.identity,
                `/api/students/${student.id}/academic-record`
            ),
            403,
            "Student academic record is not available for this school"
        );

        await schoolA.setFeature("academic_record", true);
        expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/students/${student.id}/academic-record`
            )
        );
    });

    it("blocks enrollment mutations but keeps read endpoints working", async () => {
        const enrollmentPayload = {
            student_id: secondStudent.id,
            class_id: classroom.id,
            school_year_id: schoolA.currentSchoolYear.id,
            grade_level: 7,
            subject_ids: [subject.id],
        };

        await schoolA.setFeature("enrollments", false);

        expectError(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload),
            403,
            "Enrollments is not available for this school"
        );

        expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/enrollments/class/${classroom.id}/school-year/${schoolA.currentSchoolYear.id}`
            )
        );

        await schoolA.setFeature("enrollments", true);

        expectSuccess(
            await api
                .post(schoolA.admin.identity, "/api/enrollments")
                .send(enrollmentPayload),
            201
        );

        const roster = expectSuccess(
            await api.get(
                schoolA.admin.identity,
                `/api/enrollments/class/${classroom.id}/school-year/${schoolA.currentSchoolYear.id}`
            )
        );
        expect((roster.data as { student_id: string }[]).length).toBe(2);
    });

    it("lets a super admin and a token without a school bypass the gate", async () => {
        const gate = requireFeature("gradebook");

        const superNext = vi.fn();
        await gate(
            { user: { id: superAdmin.id, role: "super_admin", school_id: 0 } } as never,
            {} as never,
            superNext
        );
        expect(superNext).toHaveBeenCalledWith();

        const schoollessNext = vi.fn();
        await gate(
            { user: { id: faculty.id, role: "faculty" } } as never,
            {} as never,
            schoollessNext
        );
        expect(schoollessNext).toHaveBeenCalledWith();
    });
});
