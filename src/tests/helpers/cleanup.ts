import type { PoolConnection } from "mysql2/promise";
import type { SqlParams } from "./db.js";
import { UUIDToBuffer } from "../../helper/UUIDToBuffer.js";

export interface CleanupTargets {
    /** Numeric school ids owned by the test file. */
    schoolIds: number[];
    /** Extra user ids without a school (for example a super admin). */
    userIds?: string[];
}

/**
 * Deletes every row created for the given schools, in FK-safe order.
 *
 * Only fixture-owned rows are touched: every statement is scoped by the
 * fixture school ids. There is no TRUNCATE and no table-wide DELETE.
 */
export async function cleanupTestData(
    connection: PoolConnection,
    targets: CleanupTargets
): Promise<void> {
    const { schoolIds } = targets;
    const userIds = targets.userIds ?? [];
    if (schoolIds.length === 0 && userIds.length === 0) return;

    const ph = schoolIds.map(() => "?").join(",");
    const params: SqlParams = schoolIds;
    // A statement that references two school scopes needs the ids twice.
    const doubledParams: SqlParams = [...schoolIds, ...schoolIds];

    const statements: [string, SqlParams][] = [];

    if (schoolIds.length > 0) {
        const classScope = `SELECT id FROM classes WHERE school_id IN (${ph})`;
        const moduleScope = `SELECT id FROM modules WHERE school_id IN (${ph})`;
        const enrollmentScope =
            `SELECT id FROM enrollments WHERE class_id IN (${classScope})`;

        statements.push(
            [
                `DELETE FROM grades WHERE grade_item_id IN
                    (SELECT id FROM grade_items WHERE class_id IN (${classScope}))`,
                params,
            ],
            [`DELETE FROM attendance_records WHERE class_id IN (${classScope})`, params],
            [`DELETE FROM attendance_sessions WHERE class_id IN (${classScope})`, params],
            [`DELETE FROM period_finalizations WHERE school_id IN (${ph})`, params],
            [`DELETE FROM grade_items WHERE class_id IN (${classScope})`, params],
            [`DELETE FROM grading_weights WHERE class_id IN (${classScope})`, params],
            [
                `DELETE FROM enrollment_subjects WHERE enrollment_id IN (${enrollmentScope})`,
                params,
            ],
            [`DELETE FROM enrollments WHERE class_id IN (${classScope})`, params],
            [
                `DELETE FROM class_modules WHERE classroom_id IN (${classScope})
                 OR module_id IN (${moduleScope})`,
                doubledParams,
            ],
            [
                `DELETE FROM module_lessons WHERE module_id IN (${moduleScope})`,
                params,
            ],
            [
                `DELETE FROM module_activity_templates WHERE module_id IN (${moduleScope})`,
                params,
            ],
            [`DELETE FROM modules WHERE school_id IN (${ph})`, params],
            [`DELETE FROM class_faculties WHERE class_id IN (${classScope})`, params],
            [`DELETE FROM classes WHERE school_id IN (${ph})`, params],
            [`DELETE FROM academic_periods WHERE school_id IN (${ph})`, params],
            [`DELETE FROM school_years WHERE school_id IN (${ph})`, params],
            [`DELETE FROM subjects WHERE school_id IN (${ph})`, params],
            [`DELETE FROM students WHERE school_id IN (${ph})`, params],
            [`DELETE FROM faculties WHERE school_id IN (${ph})`, params],
            [`DELETE FROM school_features WHERE school_id IN (${ph})`, params],
            [`DELETE FROM school_admins WHERE school_id IN (${ph})`, params],
            [`DELETE FROM schools WHERE school_id IN (${ph})`, params],
            [`DELETE FROM users WHERE school_id IN (${ph})`, params]
        );

        if (userIds.length > 0) {
            const userPh = userIds.map(() => "?").join(",");
            statements.push([
                `DELETE FROM users WHERE id IN (${userPh})`,
                userIds.map(UUIDToBuffer),
            ]);
        }
    } else if (userIds.length > 0) {
        const userPh = userIds.map(() => "?").join(",");
        statements.push([
            `DELETE FROM users WHERE id IN (${userPh})`,
            userIds.map(UUIDToBuffer),
        ]);
    }

    // Disable FK checks so the delete order does not need to match every
    // optional relation, but always restore them on the pooled connection.
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
        // Run every statement so one failure cannot leave the rest of the
        // fixture rows behind, then surface the first error.
        let firstError: unknown;
        for (const [sql, sqlParams] of statements) {
            try {
                await connection.execute(sql, sqlParams);
            } catch (err) {
                firstError ??= err;
            }
        }
        if (firstError) {
            throw firstError;
        }
    } finally {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }
}
