import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PoolConnection } from "mysql2/promise";

import { databasePool } from "../../config/database.js";
import { generateRandomUUID } from "../../helper/generateRandomId.js";
import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../../helper/UUIDToBuffer.js";
import {
    createTeacherModuleService,
    getTeacherModuleService,
    listTeacherModulesService,
    updateTeacherModuleService,
} from "../../service/modules.js";
import {
    createTemplateService,
    deleteTemplateService,
    listTemplatesForOwnedModuleService,
    updateTemplateService,
} from "../../service/moduleActivityTemplates.js";
import {
    assignModuleService,
    getClassModulesService,
    getEligibleClassroomsService,
    instantiateTemplateService,
} from "../../service/classModules.js";

/**
 * Integration coverage for the teacher module library, activity templates,
 * classroom assignments and template instantiation.
 *
 * This file is intentionally order-dependent: it is a port of a single
 * end-to-end scenario (create → template → assign → instantiate → archive)
 * and later cases rely on state produced by earlier ones.
 */

let connection: PoolConnection | undefined;

const db = (): PoolConnection => {
    if (!connection) {
        throw new Error("Database connection was not established");
    }
    return connection;
};

const newUuid = (): string => bufferToUUID(generateRandomUUID());

async function expectError(
    fn: () => Promise<unknown>,
    statusCode: number,
    messageIncludes?: string
) {
    let caught: unknown;
    try {
        await fn();
    } catch (err) {
        caught = err;
    }

    expect(caught, "expected the operation to fail").toBeDefined();
    const e = caught as { statusCode?: number; message?: string };
    expect(e.statusCode).toBe(statusCode);
    if (messageIncludes) {
        expect(e.message).toContain(messageIncludes);
    }
}

function findDbCode(err: unknown, depth = 0): string | null {
    if (!err || typeof err !== "object" || depth > 5) return null;
    const e = err as { code?: string; cause?: unknown };
    if (typeof e.code === "string" && e.code.startsWith("ER_")) return e.code;
    return findDbCode(e.cause, depth + 1);
}

async function expectDuplicateKey(fn: () => Promise<unknown>) {
    let caught: unknown;
    try {
        await fn();
    } catch (err) {
        caught = err;
    }

    expect(findDbCode(caught)).toBe("ER_DUP_ENTRY");
}

describe("teacher modules and classroom activities", () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const schoolId1 = Date.now();
    const schoolId2 = Date.now() + 1;
    const schoolIds = [schoolId1, schoolId2];
    const schoolUuid1 = newUuid();
    const schoolUuid2 = newUuid();
    const adminId = newUuid();
    const admin2Id = newUuid();
    const teacher1Id = newUuid();
    const teacher2Id = newUuid();
    const studentId = newUuid();
    const subject1Id = newUuid();
    const subject2Id = newUuid();
    const subject3Id = newUuid();
    const class1Id = newUuid();
    const class2Id = newUuid();
    const class3Id = newUuid();
    const class4Id = newUuid();

    let schoolYear1 = 0;
    let schoolYear2 = 0;
    let schoolYear3 = 0;
    let period1 = 0;
    let period2 = 0;

    let moduleA = "";
    let moduleB = "";
    let templateA = "";
    let snapshotTemplate = "";
    let postUseDeleteTemplate = "";
    let assignment1: Awaited<ReturnType<typeof assignModuleService>>;
    let assignment2: Awaited<ReturnType<typeof assignModuleService>>;

    const run = async (sql: string, params: unknown[] = []) => {
        const [result] = await db().execute(sql, params as (string | number | Buffer | null)[]);
        return result as { insertId?: number; affectedRows?: number };
    };

    const createModule = async (title: string) => {
        const res = await createTeacherModuleService(teacher1Id, schoolId1, {
            title,
            description: `${title} description`,
            subject_id: subject1Id,
            lesson_content: `${title} lesson content`,
            status: "draft",
        });
        return res.id;
    };

    const createTemplate = async (moduleId: string, title: string, overrides: Record<string, unknown> = {}) => {
        const res = await createTemplateService(moduleId, teacher1Id, schoolId1, {
            title,
            instructions: `${title} instructions`,
            category: "activities",
            max_score: 20,
            sort_order: 0,
            ...overrides,
        });
        return res.id;
    };

    const getGradeItem = async (classId: string, title: string) => {
        const [rows] = await db().execute(
            `SELECT id, title, category, max_score, instructions, class_module_id, module_template_id
             FROM grade_items WHERE class_id = ? AND subject_id = ? AND title = ? LIMIT 1`,
            [UUIDToBuffer(classId), UUIDToBuffer(subject1Id), title]
        );
        return (rows as {
            id: Buffer;
            title: string;
            category: string;
            max_score: string | number;
            instructions: string | null;
            class_module_id: Buffer | null;
            module_template_id: Buffer | null;
        }[])[0] ?? null;
    };

    const countByItem = async (table: "grades" | "attendance_records", itemId: string) => {
        if (table === "grades") {
            const [rows] = await db().execute(
                `SELECT COUNT(*) AS cnt FROM grades WHERE grade_item_id = ?`,
                [UUIDToBuffer(itemId)]
            );
            return Number((rows as { cnt: number }[])[0]?.cnt ?? 0);
        }
        const [rows] = await db().execute(
            `SELECT COUNT(*) AS cnt FROM attendance_records WHERE class_id = ? AND subject_id = ?`,
            [UUIDToBuffer(class1Id), UUIDToBuffer(subject1Id)]
        );
        return Number((rows as { cnt: number }[])[0]?.cnt ?? 0);
    };

    beforeAll(async () => {
        const pool = databasePool();
        try {
            connection = await pool.getConnection();
            await connection.ping();
        } catch (err) {
            throw new Error(
                `Database unavailable. Integration tests were NOT executed. ${(err as Error).message}`
            );
        }

        await db().query("SET FOREIGN_KEY_CHECKS = 0");

        for (const [uuid, schoolId, adminUuid, email] of [
            [adminId, schoolId1, adminId, `admin-${suffix}@test.local`],
            [admin2Id, schoolId2, admin2Id, `admin2-${suffix}@test.local`],
            [teacher1Id, schoolId1, adminId, `teacher1-${suffix}@test.local`],
            [teacher2Id, schoolId1, adminId, `teacher2-${suffix}@test.local`],
            [studentId, schoolId1, adminId, `student-${suffix}@test.local`],
        ] as const) {
            const role = uuid === studentId ? "student" : uuid === teacher1Id || uuid === teacher2Id ? "faculty" : "school_admin";
            await run(
                `INSERT INTO users (id, email, password, role, status, name, school_id) VALUES (?,?,?,?,?,?,?)`,
                [UUIDToBuffer(uuid), email, "x", role, "active", email, schoolId]
            );
            if (uuid === adminUuid) {
                await run(
                    `INSERT INTO school_admins (id, email, school_id, password) VALUES (?,?,?,?)`,
                    [UUIDToBuffer(adminUuid), email, schoolId, "x"]
                );
            }
        }

        for (const [id, schoolId, adminUuid, name, email] of [
            [schoolUuid1, schoolId1, adminId, `Test School ${suffix}`, `school-${suffix}@test.local`],
            [schoolUuid2, schoolId2, admin2Id, `Test School B ${suffix}`, `school-b-${suffix}@test.local`],
        ] as const) {
            await run(
                `INSERT INTO schools
                    (id, school_id, school_name, school_level, academic_system, period_count,
                     academic_config_completed, school_email, address, region, province, city,
                     contact_number, school_logo, school_admin, admin_id)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    UUIDToBuffer(id), schoolId, name, 1, "quarter", 4, 1, email,
                    "Address", "Region", "Province", "City", "000", "", "Admin",
                    UUIDToBuffer(adminUuid),
                ]
            );
        }

        // Fix the admin user school references after schools exist.
        for (const [adminUuid, schoolId] of [[adminId, schoolId1], [admin2Id, schoolId2]] as const) {
            await run(`UPDATE users SET school_id = ? WHERE id = ?`, [schoolId, UUIDToBuffer(adminUuid)]);
        }

        for (const [id, firstName, email, adminUuid, schoolId] of [
            [teacher1Id, "Tess", `teacher1-${suffix}@test.local`, adminId, schoolId1],
            [teacher2Id, "Tomas", `teacher2-${suffix}@test.local`, adminId, schoolId1],
        ] as const) {
            await run(
                `INSERT INTO faculties
                    (id, first_name, last_name, email, password, school_id, faculty_role, admin_id, is_active)
                 VALUES (?,?,?,?,?,?,?,?,1)`,
                [UUIDToBuffer(id), firstName, "Teacher", email, "x", schoolId, "teacher", UUIDToBuffer(adminUuid)]
            );
        }

        await run(
            `INSERT INTO students
                (id, first_name, last_name, email, password, school_id, sex, admin_id)
             VALUES (?,?,?,?,?,?,?,?)`,
            [UUIDToBuffer(studentId), "Sam", "Student", `student-${suffix}@test.local`, "x", schoolId1, "male", UUIDToBuffer(adminId)]
        );

        for (const [id, name, schoolId, adminUuid] of [
            [subject1Id, `Mathematics ${suffix}`, schoolId1, adminId],
            [subject2Id, `Science ${suffix}`, schoolId2, admin2Id],
            [subject3Id, `English ${suffix}`, schoolId1, adminId],
        ] as const) {
            await run(
                `INSERT INTO subjects (id, name, subject_code, description, school_id, admin_id, is_active)
                 VALUES (?,?,?,?,?,?,1)`,
                [UUIDToBuffer(id), name, null, "Test subject", schoolId, UUIDToBuffer(adminUuid)]
            );
        }

        for (const [name, schoolId, start, end, isCurrent] of [
            [`SY-${suffix}-1`, schoolId1, "2024-06-01", "2025-05-31", 0],
            [`SY-${suffix}-2`, schoolId1, "2025-06-01", "2026-05-31", 1],
            [`SY-B-${suffix}`, schoolId2, "2025-06-01", "2026-05-31", 1],
        ] as const) {
            const result = await run(
                `INSERT INTO school_years (name, start_date, end_date, school_id, is_current)
                 VALUES (?,?,?,?,?)`,
                [name, start, end, schoolId, isCurrent]
            );
            if (schoolId === schoolId1 && start === "2024-06-01") schoolYear1 = Number(result.insertId);
            else if (schoolId === schoolId1) schoolYear2 = Number(result.insertId);
            else schoolYear3 = Number(result.insertId);
        }

        for (const [name, schoolId, yearId, number, start, end, isCurrent] of [
            [`Period 1 ${suffix}`, schoolId1, schoolYear1, 1, "2024-06-01", "2024-08-31", 1],
            [`Period 1 ${suffix}`, schoolId1, schoolYear2, 1, "2025-06-01", "2025-08-31", 1],
            [`Period B ${suffix}`, schoolId2, schoolYear3, 1, "2025-06-01", "2025-08-31", 1],
        ] as const) {
            const result = await run(
                `INSERT INTO academic_periods
                    (school_id, school_year_id, name, period_number, start_date, end_date, is_current)
                 VALUES (?,?,?,?,?,?,?)`,
                [schoolId, yearId, name, number, start, end, isCurrent]
            );
            if (yearId === schoolYear1) period1 = Number(result.insertId);
            else if (yearId === schoolYear2) period2 = Number(result.insertId);
        }

        for (const [id, name, schoolId, yearId, teacherId] of [
            [class1Id, `Class A ${suffix}`, schoolId1, schoolYear1, teacher1Id],
            [class2Id, `Class B ${suffix}`, schoolId1, schoolYear2, teacher1Id],
            [class3Id, `Class C ${suffix}`, schoolId1, schoolYear1, teacher2Id],
            [class4Id, `Class D ${suffix}`, schoolId2, schoolYear3, teacher2Id],
        ] as const) {
            await run(
                `INSERT INTO classes
                    (id, class_name, school_id, school_year_id, faculty_id, capacity, section, grade_level, is_active)
                 VALUES (?,?,?,?,?,?,?,?,1)`,
                [UUIDToBuffer(id), name, schoolId, yearId, UUIDToBuffer(teacherId), 40, "A", "7"]
            );
        }

        for (const [classId, teacherId, yearId] of [
            [class1Id, teacher1Id, schoolYear1],
            [class2Id, teacher1Id, schoolYear2],
            [class3Id, teacher2Id, schoolYear1],
        ] as const) {
            await run(
                `INSERT INTO class_faculties (class_id, faculty_id, subject_id, school_year_id)
                 VALUES (?,?,?,?)`,
                [UUIDToBuffer(classId), UUIDToBuffer(teacherId), UUIDToBuffer(subject1Id), yearId]
            );
        }

        await db().query("SET FOREIGN_KEY_CHECKS = 1");
    });

    afterAll(async () => {
        if (!connection) {
            return;
        }

        try {
            await connection.query("SET FOREIGN_KEY_CHECKS = 0");
            const placeholders = schoolIds.map(() => "?").join(",");
            const classIds = [class1Id, class2Id, class3Id, class4Id];
            const classPlaceholders = classIds.map(() => "?").join(",");
            const classParams = classIds.map(UUIDToBuffer);

            await run(
                `DELETE FROM grades WHERE grade_item_id IN
                    (SELECT id FROM grade_items WHERE class_id IN (${classPlaceholders}))`,
                classParams
            );
            await run(`DELETE FROM attendance_records WHERE class_id IN (${classPlaceholders})`, classParams);
            await run(`DELETE FROM period_finalizations WHERE class_id IN (${classPlaceholders})`, classParams);
            await run(
                `DELETE FROM class_modules WHERE classroom_id IN (${classPlaceholders})
                 OR module_id IN (SELECT id FROM modules WHERE school_id IN (${placeholders}))`,
                [...classParams, ...schoolIds]
            );
            await run(
                `DELETE FROM module_activity_templates WHERE module_id IN
                    (SELECT id FROM modules WHERE school_id IN (${placeholders}))`,
                schoolIds
            );
            await run(`DELETE FROM modules WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM enrollments WHERE class_id IN (${classPlaceholders})`, classParams);
            await run(`DELETE FROM classes WHERE id IN (${classPlaceholders})`, classParams);
            await run(`DELETE FROM class_faculties WHERE class_id IN (${classPlaceholders})`, classParams);
            await run(`DELETE FROM academic_periods WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM school_years WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM subjects WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM students WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM faculties WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM school_admins WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM schools WHERE school_id IN (${placeholders})`, schoolIds);
            await run(`DELETE FROM users WHERE school_id IN (${placeholders})`, schoolIds);
            await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        } finally {
            connection.release();
            connection = undefined;
        }
    });

    describe("teacher module library", () => {
        it("creates a module and lists it for its owner", async () => {
            moduleA = await createModule(`Algebra ${suffix}`);
            moduleB = await createModule(`Archived ${suffix}`);

            const listed = await listTeacherModulesService(teacher1Id, schoolId1, {});
            expect(listed.some((m) => m.id === moduleA)).toBe(true);
            expect(listed.every((m) => !m.owner_faculty_id || m.owner_faculty_id === teacher1Id)).toBe(true);
        });

        it("keeps other teachers' modules out of each list", async () => {
            const moduleC = await createTeacherModuleService(teacher2Id, schoolId1, {
                title: `Biology ${suffix}`,
                subject_id: subject1Id,
                status: "draft",
            });

            const t1List = await listTeacherModulesService(teacher1Id, schoolId1, {});
            const t2List = await listTeacherModulesService(teacher2Id, schoolId1, {});

            expect(t1List.some((m) => m.id === moduleC.id)).toBe(false);
            expect(t2List.some((m) => m.id === moduleC.id)).toBe(true);
        });

        it("rejects reading and updating another teacher's module", async () => {
            await expectError(() => getTeacherModuleService(teacher2Id, schoolId1, moduleA), 403);
            await expectError(
                () => updateTeacherModuleService(teacher2Id, schoolId1, moduleA, { title: "Hijacked" }),
                403
            );
        });

        it("rejects an invalid subject", async () => {
            await expectError(
                () => createTeacherModuleService(teacher1Id, schoolId1, {
                    title: "Invalid subject",
                    subject_id: newUuid(),
                    status: "draft",
                }),
                400
            );
        });

        it("rejects a subject from another school", async () => {
            await expectError(
                () => createTeacherModuleService(teacher1Id, schoolId1, {
                    title: "Cross-school subject",
                    subject_id: subject2Id,
                    status: "draft",
                }),
                400
            );
        });

        it("rejects an invalid module status", async () => {
            await expectError(
                () => createTeacherModuleService(teacher1Id, schoolId1, {
                    title: "Invalid status",
                    subject_id: subject1Id,
                    status: "not-a-status",
                }),
                400
            );
        });
    });

    describe("activity templates", () => {
        it("creates and lists templates with their fields", async () => {
            templateA = await createTemplate(moduleA, `Warm-up ${suffix}`);
            snapshotTemplate = await createTemplate(moduleA, `Snapshot ${suffix}`, { category: "quizzes", max_score: 30 });
            postUseDeleteTemplate = await createTemplate(moduleA, `Used Then Deleted ${suffix}`, {
                category: "exams",
                max_score: 50,
            });

            const templates = await listTemplatesForOwnedModuleService(moduleA, teacher1Id, schoolId1);
            expect(templates).toHaveLength(3);

            const templateAItem = templates.find((t) => t.id === templateA);
            expect(templateAItem?.title).toBe(`Warm-up ${suffix}`);
            expect(templateAItem?.max_score).toBe(20);
        });

        it("updates a template", async () => {
            await updateTemplateService(moduleA, templateA, teacher1Id, schoolId1, {
                title: `Warm-up Updated ${suffix}`,
                instructions: "Updated instructions",
                max_score: 25,
                sort_order: 2,
            });

            const updatedTemplates = await listTemplatesForOwnedModuleService(moduleA, teacher1Id, schoolId1);
            const updatedTemplateA = updatedTemplates.find((t) => t.id === templateA);
            expect(updatedTemplateA?.title).toBe(`Warm-up Updated ${suffix}`);
            expect(updatedTemplateA?.max_score).toBe(25);
        });

        it("validates template title, max score and category", async () => {
            await expectError(() => createTemplateService(moduleA, teacher1Id, schoolId1, {
                title: "   ",
                max_score: 10,
            }), 400);
            await expectError(() => createTemplateService(moduleA, teacher1Id, schoolId1, {
                title: "Bad score",
                max_score: 0,
            }), 400);
            await expectError(() => createTemplateService(moduleA, teacher1Id, schoolId1, {
                title: "Bad category",
                category: "homework",
                max_score: 10,
            }), 400);
        });

        it("rejects templates from another teacher", async () => {
            await expectError(() => createTemplateService(moduleA, teacher2Id, schoolId1, {
                title: "Unauthorized",
                max_score: 10,
            }), 403);
        });

        it("deletes a template", async () => {
            const deleteTemplate = await createTemplate(moduleA, `Temporary ${suffix}`, {
                category: "exams",
                max_score: 50,
            });

            await deleteTemplateService(moduleA, deleteTemplate, teacher1Id, schoolId1);
            const afterDelete = await listTemplatesForOwnedModuleService(moduleA, teacher1Id, schoolId1);
            expect(afterDelete.some((t) => t.id === deleteTemplate)).toBe(false);
        });
    });

    describe("classroom assignments", () => {
        it("assigns a module to classes in two school years", async () => {
            assignment1 = await assignModuleService(moduleA, class1Id, schoolYear1, teacher1Id, schoolId1);
            assignment2 = await assignModuleService(moduleA, class2Id, schoolYear2, teacher1Id, schoolId1);

            expect(assignment1.id).toBeTruthy();
            expect(assignment2.id).toBeTruthy();
        });

        it("rejects a duplicate assignment", async () => {
            await expectError(
                () => assignModuleService(moduleA, class1Id, schoolYear1, teacher1Id, schoolId1),
                409
            );
        });

        it("rejects a class from another school", async () => {
            await expectError(
                () => assignModuleService(moduleA, class4Id, schoolYear3, teacher1Id, schoolId1),
                403
            );
        });

        it("rejects a mismatched school year", async () => {
            await expectError(
                () => assignModuleService(moduleA, class1Id, schoolYear2, teacher1Id, schoolId1),
                400
            );
        });

        it("rejects a class the teacher does not teach", async () => {
            await expectError(
                () => assignModuleService(moduleA, class3Id, schoolYear1, teacher1Id, schoolId1),
                403
            );
        });

        it("rejects new assignments for an archived module", async () => {
            await updateTeacherModuleService(teacher1Id, schoolId1, moduleB, { status: "archived" });
            await expectError(
                () => assignModuleService(moduleB, class1Id, schoolYear1, teacher1Id, schoolId1),
                400
            );
        });

        it("rejects a subject change while assignments exist", async () => {
            await expectError(
                () => updateTeacherModuleService(teacher1Id, schoolId1, moduleA, { subject_id: subject3Id }),
                409
            );
        });

        it("lists eligible classrooms with assignment state", async () => {
            const eligible = await getEligibleClassroomsService(moduleA, teacher1Id, schoolId1);
            const eligibleIds = eligible.map((room) => room.classroom_id);

            expect(eligibleIds).not.toContain(class3Id);
            expect(eligibleIds).not.toContain(class4Id);
            expect(eligible.find((room) => room.classroom_id === class1Id)?.already_assigned).toBe(true);
            expect(eligible.find((room) => room.classroom_id === class2Id)?.already_assigned).toBe(true);
        });

        it("returns assigned modules for a class", async () => {
            const classModules = await getClassModulesService(class1Id, teacher1Id, schoolId1);
            expect(classModules.some((m) => m.module_id === moduleA)).toBe(true);
        });
    });

    describe("template instantiation", () => {
        const activityTitle = `Warm-up ${suffix}`;

        it("creates one grade item with copied fields and provenance", async () => {
            const activity1 = await instantiateTemplateService(assignment1.id, {
                template_id: templateA,
                period_id: period1,
                title: activityTitle,
                max_score: 20,
            }, teacher1Id, schoolId1);

            const gradeItem1 = await getGradeItem(class1Id, activityTitle);

            expect(activity1.id).toBeTruthy();
            expect(gradeItem1).toBeTruthy();
            expect(gradeItem1?.title).toBe(activityTitle);
            expect(gradeItem1?.category).toBe("activities");
            expect(Number(gradeItem1?.max_score)).toBe(20);
            expect(gradeItem1?.instructions).toBe("Updated instructions");
            expect(gradeItem1?.class_module_id).toBeTruthy();
            expect(bufferToUUID(gradeItem1!.class_module_id!)).toBe(assignment1.id);
            expect(gradeItem1?.module_template_id).toBeTruthy();
            expect(bufferToUUID(gradeItem1!.module_template_id!)).toBe(templateA);
        });

        it("creates no grade or attendance rows", async () => {
            const [activityRows] = await db().execute(
                `SELECT id FROM grade_items WHERE class_id = ? AND subject_id = ? AND title = ? LIMIT 1`,
                [UUIDToBuffer(class1Id), UUIDToBuffer(subject1Id), activityTitle]
            );
            const activityId = bufferToUUID((activityRows as { id: Buffer }[])[0]!.id);

            expect(await countByItem("grades", activityId)).toBe(0);
            expect(await countByItem("attendance_records", activityId)).toBe(0);
        });

        it("rejects a duplicate activity title", async () => {
            await expectDuplicateKey(
                () => instantiateTemplateService(assignment1.id, {
                    template_id: templateA,
                    period_id: period1,
                    title: activityTitle,
                    max_score: 20,
                }, teacher1Id, schoolId1)
            );
        });

        it("keeps activities independent across classrooms", async () => {
            const activity2 = await instantiateTemplateService(assignment2.id, {
                template_id: templateA,
                period_id: period2,
                title: activityTitle,
                max_score: 20,
            }, teacher1Id, schoolId1);

            const gradeItem2 = await getGradeItem(class2Id, activityTitle);
            expect(activity2.id).toBeTruthy();
            expect(gradeItem2).toBeTruthy();
            expect(gradeItem2?.title).toBe(activityTitle);
        });

        it("does not change an instantiated activity when its template is edited", async () => {
            const snapshotTitle = `Snapshot Activity ${suffix}`;
            const snapshotActivity = await instantiateTemplateService(assignment1.id, {
                template_id: snapshotTemplate,
                period_id: period1,
                title: snapshotTitle,
                max_score: 30,
            }, teacher1Id, schoolId1);

            const snapshotBefore = await getGradeItem(class1Id, snapshotTitle);
            expect(snapshotActivity.id).toBeTruthy();

            await updateTemplateService(moduleA, snapshotTemplate, teacher1Id, schoolId1, {
                title: `Snapshot Changed ${suffix}`,
                instructions: "Changed after use",
                max_score: 99,
            });

            const snapshotAfter = await getGradeItem(class1Id, snapshotTitle);
            expect(snapshotAfter?.title).toBe(snapshotTitle);
            expect(snapshotAfter?.instructions).toBe(`${snapshotTitle.replace(" Activity", "")} instructions`);
            expect(Number(snapshotAfter?.max_score)).toBe(30);
            expect(snapshotBefore?.id.equals(snapshotAfter!.id)).toBe(true);
        });

        it("keeps the activity when its template is deleted", async () => {
            const deletedTitle = `Delete Template Activity ${suffix}`;
            const deletedActivity = await instantiateTemplateService(assignment1.id, {
                template_id: postUseDeleteTemplate,
                period_id: period1,
                title: deletedTitle,
                max_score: 50,
            }, teacher1Id, schoolId1);

            await deleteTemplateService(moduleA, postUseDeleteTemplate, teacher1Id, schoolId1);

            const afterTemplateDelete = await getGradeItem(class1Id, deletedTitle);
            expect(deletedActivity.id).toBeTruthy();
            expect(afterTemplateDelete).toBeTruthy();
            expect(afterTemplateDelete?.module_template_id).toBeNull();
        });

        it("allows an archived module's existing assignment to create activities", async () => {
            await updateTeacherModuleService(teacher1Id, schoolId1, moduleA, { status: "archived" });

            const archivedActivityTitle = `Archived Module Activity ${suffix}`;
            await instantiateTemplateService(assignment1.id, {
                template_id: snapshotTemplate,
                period_id: period1,
                title: archivedActivityTitle,
                max_score: 30,
            }, teacher1Id, schoolId1);

            expect(await getGradeItem(class1Id, archivedActivityTitle)).toBeTruthy();
        });

        it("leaves assignments and activities intact after archiving", async () => {
            const [moduleRows] = await db().execute(
                `SELECT COUNT(*) AS cnt FROM class_modules WHERE module_id = ?`,
                [UUIDToBuffer(moduleA)]
            );
            const [activityRows] = await db().execute(
                `SELECT COUNT(*) AS cnt FROM grade_items WHERE class_id = ?`,
                [UUIDToBuffer(class1Id)]
            );

            expect(Number((moduleRows as { cnt: number }[])[0]?.cnt ?? 0)).toBe(2);
            expect(Number((activityRows as { cnt: number }[])[0]?.cnt ?? 0)).toBeGreaterThanOrEqual(4);
        });

        it("rejects a period from another school year", async () => {
            await expectError(
                () => instantiateTemplateService(assignment1.id, {
                    template_id: snapshotTemplate,
                    period_id: period2,
                    title: `Wrong Period ${suffix}`,
                    max_score: 10,
                }, teacher1Id, schoolId1),
                400
            );
        });

        it("rejects activity creation in a finalized period", async () => {
            await run(
                `INSERT INTO period_finalizations
                    (school_id, school_year_id, period_id, class_id, subject_id, student_id, final_grade, finalized_by)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [schoolId1, schoolYear2, period2, UUIDToBuffer(class2Id), UUIDToBuffer(subject1Id), UUIDToBuffer(studentId), 90, UUIDToBuffer(teacher1Id)]
            );

            await expectError(
                () => instantiateTemplateService(assignment2.id, {
                    template_id: templateA,
                    period_id: period2,
                    title: `Finalized Period ${suffix}`,
                    max_score: 10,
                }, teacher1Id, schoolId1),
                400,
                "finalized"
            );
        });
    });
});
