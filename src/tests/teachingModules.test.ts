import dotenv from "dotenv";
import { databasePool } from "../config/database.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import {
    createTeacherModuleService,
    getTeacherModuleService,
    listTeacherModulesService,
    updateTeacherModuleService,
} from "../service/modules.js";
import {
    createTemplateService,
    deleteTemplateService,
    listTemplatesForOwnedModuleService,
    updateTemplateService,
} from "../service/moduleActivityTemplates.js";
import {
    assignModuleService,
    getClassModulesService,
    getEligibleClassroomsService,
    instantiateTemplateService,
} from "../service/classModules.js";

dotenv.config({ path: ".env" });
dotenv.config({
    path: process.env.SYSTEM_STATUS === "production" ? ".env.production" : ".env.development",
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
        passed++;
        console.log(`  PASS ${testName}`);
    } else {
        failed++;
        console.log(`  FAIL ${testName}${details ? ` - ${details}` : ""}`);
    }
}

const newUuid = (): string => bufferToUUID(generateRandomUUID());

async function expectError(
    testName: string,
    fn: () => Promise<unknown>,
    statusCode: number,
    messageIncludes?: string
) {
    try {
        await fn();
        assert(false, testName, "expected an error but the operation succeeded");
    } catch (err) {
        const e = err as { statusCode?: number; message?: string; cause?: unknown };
        const suffix = `${e.statusCode ?? "no-status"} ${e.message ?? ""}`;
        assert(
            e.statusCode === statusCode && (!messageIncludes || (e.message ?? "").includes(messageIncludes)),
            testName,
            `expected ${statusCode}${messageIncludes ? ` containing "${messageIncludes}"` : ""}, got ${suffix}`
        );
    }
}

function findDbCode(err: unknown, depth = 0): string | null {
    if (!err || typeof err !== "object" || depth > 5) return null;
    const e = err as { code?: string; cause?: unknown };
    if (typeof e.code === "string" && e.code.startsWith("ER_")) return e.code;
    return findDbCode(e.cause, depth + 1);
}

async function expectDuplicateKey(testName: string, fn: () => Promise<unknown>) {
    try {
        await fn();
        assert(false, testName, "expected a duplicate-key error but the operation succeeded");
    } catch (err) {
        assert(findDbCode(err) === "ER_DUP_ENTRY", testName, `expected ER_DUP_ENTRY, got ${findDbCode(err) ?? "unknown error"}`);
    }
}

async function main() {
    const pool = databasePool();
    let connection: Awaited<ReturnType<typeof pool.getConnection>>;
    try {
        connection = await pool.getConnection();
        await connection.ping();
    } catch (err) {
        console.error("Database unavailable. Integration tests were NOT executed.");
        console.error((err as Error).message);
        process.exitCode = 1;
        return;
    }

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

    const run = async (sql: string, params: unknown[] = []) => {
        const [result] = await connection.execute(sql, params as (string | number | Buffer | null)[]);
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
        const [rows] = await connection.execute(
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
            const [rows] = await connection.execute(
                `SELECT COUNT(*) AS cnt FROM grades WHERE grade_item_id = ?`,
                [UUIDToBuffer(itemId)]
            );
            return Number((rows as { cnt: number }[])[0]?.cnt ?? 0);
        }
        const [rows] = await connection.execute(
            `SELECT COUNT(*) AS cnt FROM attendance_records WHERE class_id = ? AND subject_id = ?`,
            [UUIDToBuffer(class1Id), UUIDToBuffer(subject1Id)]
        );
        return Number((rows as { cnt: number }[])[0]?.cnt ?? 0);
    };

    try {
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");

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

        await connection.query("SET FOREIGN_KEY_CHECKS = 1");

        console.log("\n=== Teacher module tests ===");

        const moduleA = await createModule(`Algebra ${suffix}`);
        const moduleB = await createModule(`Archived ${suffix}`);
        const listed = await listTeacherModulesService(teacher1Id, schoolId1, {});
        assert(listed.some((m) => m.id === moduleA), "Teacher can create and list a module");
        assert(listed.every((m) => !m.owner_faculty_id || m.owner_faculty_id === teacher1Id), "Teacher list only contains own modules");

        const moduleC = await createTeacherModuleService(teacher2Id, schoolId1, {
            title: `Biology ${suffix}`,
            subject_id: subject1Id,
            status: "draft",
        });
        const t1List = await listTeacherModulesService(teacher1Id, schoolId1, {});
        const t2List = await listTeacherModulesService(teacher2Id, schoolId1, {});
        assert(!t1List.some((m) => m.id === moduleC.id), "Other teachers' modules are excluded from the list");
        assert(t2List.some((m) => m.id === moduleC.id), "Each teacher sees their own modules");

        await expectError(
            "Teacher cannot view another teacher's module",
            () => getTeacherModuleService(teacher2Id, schoolId1, moduleA),
            403
        );
        await expectError(
            "Teacher cannot update another teacher's module",
            () => updateTeacherModuleService(teacher2Id, schoolId1, moduleA, { title: "Hijacked" }),
            403
        );

        await expectError(
            "Invalid subject is rejected",
            () => createTeacherModuleService(teacher1Id, schoolId1, {
                title: "Invalid subject",
                subject_id: newUuid(),
                status: "draft",
            }),
            400
        );
        await expectError(
            "Cross-school subject is rejected",
            () => createTeacherModuleService(teacher1Id, schoolId1, {
                title: "Cross-school subject",
                subject_id: subject2Id,
                status: "draft",
            }),
            400
        );
        await expectError(
            "Invalid status is rejected",
            () => createTeacherModuleService(teacher1Id, schoolId1, {
                title: "Invalid status",
                subject_id: subject1Id,
                status: "not-a-status",
            }),
            400
        );

        console.log("\n=== Template tests ===");

        const templateA = await createTemplate(moduleA, `Warm-up ${suffix}`);
        const snapshotTemplate = await createTemplate(moduleA, `Snapshot ${suffix}`, { category: "quizzes", max_score: 30 });
        const deleteTemplate = await createTemplate(moduleA, `Temporary ${suffix}`, { category: "exams", max_score: 50 });
        const templates = await listTemplatesForOwnedModuleService(moduleA, teacher1Id, schoolId1);
        assert(templates.length === 3, "Template create and list work");
        const templateAItem = templates.find((t) => t.id === templateA);
        assert(templateAItem?.title === `Warm-up ${suffix}` && templateAItem?.max_score === 20, "Template fields are returned");

        await updateTemplateService(moduleA, templateA, teacher1Id, schoolId1, {
            title: `Warm-up Updated ${suffix}`,
            instructions: "Updated instructions",
            max_score: 25,
            sort_order: 2,
        });
        const updatedTemplates = await listTemplatesForOwnedModuleService(moduleA, teacher1Id, schoolId1);
        const updatedTemplateA = updatedTemplates.find((t) => t.id === templateA);
        assert(updatedTemplateA?.title === `Warm-up Updated ${suffix}` && updatedTemplateA?.max_score === 25, "Template update works");

        await expectError("Template title is required", () => createTemplateService(moduleA, teacher1Id, schoolId1, {
            title: "   ",
            max_score: 10,
        }), 400);
        await expectError("Template max score must be positive", () => createTemplateService(moduleA, teacher1Id, schoolId1, {
            title: "Bad score",
            max_score: 0,
        }), 400);
        await expectError("Template category is validated", () => createTemplateService(moduleA, teacher1Id, schoolId1, {
            title: "Bad category",
            category: "homework",
            max_score: 10,
        }), 400);
        await expectError("Another teacher cannot add templates", () => createTemplateService(moduleA, teacher2Id, schoolId1, {
            title: "Unauthorized",
            max_score: 10,
        }), 403);

        await deleteTemplateService(moduleA, deleteTemplate, teacher1Id, schoolId1);
        const afterDelete = await listTemplatesForOwnedModuleService(moduleA, teacher1Id, schoolId1);
        assert(!afterDelete.some((t) => t.id === deleteTemplate), "Template delete works");

        const postUseDeleteTemplate = await createTemplate(moduleA, `Used Then Deleted ${suffix}`, {
            category: "exams",
            max_score: 50,
        });

        console.log("\n=== Assignment tests ===");

        const assignment1 = await assignModuleService(moduleA, class1Id, schoolYear1, teacher1Id, schoolId1);
        const assignment2 = await assignModuleService(moduleA, class2Id, schoolYear2, teacher1Id, schoolId1);
        assert(Boolean(assignment1.id && assignment2.id), "Module can be assigned across two school years");

        await expectError(
            "Duplicate assignment is rejected",
            () => assignModuleService(moduleA, class1Id, schoolYear1, teacher1Id, schoolId1),
            409
        );
        await expectError(
            "Assignment to a class from another school is rejected",
            () => assignModuleService(moduleA, class4Id, schoolYear3, teacher1Id, schoolId1),
            403
        );
        await expectError(
            "Assignment with a mismatched school year is rejected",
            () => assignModuleService(moduleA, class1Id, schoolYear2, teacher1Id, schoolId1),
            400
        );
        await expectError(
            "Teacher cannot assign to a class they do not teach",
            () => assignModuleService(moduleA, class3Id, schoolYear1, teacher1Id, schoolId1),
            403
        );

        await updateTeacherModuleService(teacher1Id, schoolId1, moduleB, { status: "archived" });
        await expectError(
            "Archived module cannot be newly assigned",
            () => assignModuleService(moduleB, class1Id, schoolYear1, teacher1Id, schoolId1),
            400
        );
        await expectError(
            "Module subject cannot change while assignments exist",
            () => updateTeacherModuleService(teacher1Id, schoolId1, moduleA, { subject_id: subject3Id }),
            409
        );

        const eligible = await getEligibleClassroomsService(moduleA, teacher1Id, schoolId1);
        const eligibleIds = eligible.map((room) => room.classroom_id);
        assert(
            !eligibleIds.includes(class3Id) && !eligibleIds.includes(class4Id),
            "Eligible classrooms exclude unauthorized classes"
        );
        assert(
            eligible.find((room) => room.classroom_id === class1Id)?.already_assigned === true
            && eligible.find((room) => room.classroom_id === class2Id)?.already_assigned === true,
            "Eligible classrooms mark already-assigned classes"
        );

        const classModules = await getClassModulesService(class1Id, teacher1Id, schoolId1);
        assert(classModules.some((m) => m.module_id === moduleA), "Class module list returns assigned modules");

        console.log("\n=== Activity instantiation tests ===");

        const activityTitle = `Warm-up ${suffix}`;
        const activity1 = await instantiateTemplateService(assignment1.id, {
            template_id: templateA,
            period_id: period1,
            title: activityTitle,
            max_score: 20,
        }, teacher1Id, schoolId1);
        const gradeItem1 = await getGradeItem(class1Id, activityTitle);
        assert(Boolean(activity1.id && gradeItem1), "Template instantiation creates one grade item");
        assert(
            gradeItem1?.title === activityTitle
            && gradeItem1?.category === "activities"
            && Number(gradeItem1?.max_score) === 20
            && gradeItem1?.instructions === "Updated instructions",
            "Instantiated activity copies title, category, max score, and instructions"
        );
        assert(
            Boolean(gradeItem1?.class_module_id) && bufferToUUID(gradeItem1!.class_module_id!) === assignment1.id
            && Boolean(gradeItem1?.module_template_id) && bufferToUUID(gradeItem1!.module_template_id!) === templateA,
            "Instantiated activity stores provenance IDs"
        );
        assert((await countByItem("grades", activity1.id)) === 0, "Instantiation creates no grade rows");
        assert((await countByItem("attendance_records", activity1.id)) === 0, "Instantiation creates no attendance records");

        await expectDuplicateKey(
            "Duplicate activity title returns a duplicate-key error",
            () => instantiateTemplateService(assignment1.id, {
                template_id: templateA,
                period_id: period1,
                title: activityTitle,
                max_score: 20,
            }, teacher1Id, schoolId1)
        );

        const activity2 = await instantiateTemplateService(assignment2.id, {
            template_id: templateA,
            period_id: period2,
            title: activityTitle,
            max_score: 20,
        }, teacher1Id, schoolId1);
        const gradeItem2 = await getGradeItem(class2Id, activityTitle);
        assert(activity1.id !== activity2.id && Boolean(gradeItem2), "Activities in two classrooms are independent");

        const snapshotTitle = `Snapshot Activity ${suffix}`;
        const snapshotActivity = await instantiateTemplateService(assignment1.id, {
            template_id: snapshotTemplate,
            period_id: period1,
            title: snapshotTitle,
            max_score: 30,
        }, teacher1Id, schoolId1);
        const snapshotBefore = await getGradeItem(class1Id, snapshotTitle);
        await updateTemplateService(moduleA, snapshotTemplate, teacher1Id, schoolId1, {
            title: `Snapshot Changed ${suffix}`,
            instructions: "Changed after use",
            max_score: 99,
        });
        const snapshotAfter = await getGradeItem(class1Id, snapshotTitle);
        assert(
            snapshotAfter?.title === snapshotTitle
            && snapshotAfter?.instructions === `${snapshotTitle.replace(" Activity", "")} instructions`
            && Number(snapshotAfter?.max_score) === 30,
            "Template edit after instantiation does not change the existing activity"
        );
        assert(snapshotBefore?.id.equals(snapshotAfter!.id) === true, "Snapshot activity remains the same row");

        const deletedTitle = `Delete Template Activity ${suffix}`;
        const deletedActivity = await instantiateTemplateService(assignment1.id, {
            template_id: postUseDeleteTemplate,
            period_id: period1,
            title: deletedTitle,
            max_score: 50,
        }, teacher1Id, schoolId1);
        await deleteTemplateService(moduleA, postUseDeleteTemplate, teacher1Id, schoolId1);
        const afterTemplateDelete = await getGradeItem(class1Id, deletedTitle);
        assert(Boolean(afterTemplateDelete), "Template delete does not delete the activity");
        assert(afterTemplateDelete?.module_template_id === null, "Template delete clears provenance only");
        assert(Boolean(snapshotActivity.id && deletedActivity.id), "Activities were created before template deletion");

        await updateTeacherModuleService(teacher1Id, schoolId1, moduleA, { status: "archived" });
        const archivedActivityTitle = `Archived Module Activity ${suffix}`;
        await instantiateTemplateService(assignment1.id, {
            template_id: snapshotTemplate,
            period_id: period1,
            title: archivedActivityTitle,
            max_score: 30,
        }, teacher1Id, schoolId1);
        assert(Boolean(await getGradeItem(class1Id, archivedActivityTitle)), "Archived module's existing assignment can still create activities");

        const [moduleRows] = await connection.execute(
            `SELECT COUNT(*) AS cnt FROM class_modules WHERE module_id = ?`,
            [UUIDToBuffer(moduleA)]
        );
        const [activityRows] = await connection.execute(
            `SELECT COUNT(*) AS cnt FROM grade_items WHERE class_id = ?`,
            [UUIDToBuffer(class1Id)]
        );
        assert(
            Number((moduleRows as { cnt: number }[])[0]?.cnt ?? 0) === 2
            && Number((activityRows as { cnt: number }[])[0]?.cnt ?? 0) >= 4,
            "Archiving leaves assignments and activities intact"
        );

        await expectError(
            "Period from another school year is rejected",
            () => instantiateTemplateService(assignment1.id, {
                template_id: snapshotTemplate,
                period_id: period2,
                title: `Wrong Period ${suffix}`,
                max_score: 10,
            }, teacher1Id, schoolId1),
            400
        );

        await run(
            `INSERT INTO period_finalizations
                (school_id, school_year_id, period_id, class_id, subject_id, student_id, final_grade, finalized_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [schoolId1, schoolYear2, period2, UUIDToBuffer(class2Id), UUIDToBuffer(subject1Id), UUIDToBuffer(studentId), 90, UUIDToBuffer(teacher1Id)]
        );
        await expectError(
            "Finalized period rejects activity creation",
            () => instantiateTemplateService(assignment2.id, {
                template_id: templateA,
                period_id: period2,
                title: `Finalized Period ${suffix}`,
                max_score: 10,
            }, teacher1Id, schoolId1),
            400,
            "finalized"
        );

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        process.exitCode = failed > 0 ? 1 : 0;
    } catch (err) {
        console.error("Integration test aborted:", err);
        process.exitCode = 1;
    } finally {
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
        } catch (cleanupErr) {
            console.error("Fixture cleanup failed:", cleanupErr);
            process.exitCode = 1;
        } finally {
            connection.release();
            await pool.end();
        }
    }
}

void main();
