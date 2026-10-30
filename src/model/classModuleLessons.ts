import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
    LessonClassAssignmentRow,
    StudentLessonFileRow,
    StudentLessonRow,
} from "../constant/classModuleLessons.js";
import { InternalServerError } from "../helper/error.js";

export default class ClassModuleLessonModel {
    constructor(private connection: PoolConnection) {}

    async listTeacherAssignments(
        moduleId: Buffer,
        lessonId: Buffer
    ): Promise<LessonClassAssignmentRow[]> {
        try {
            const query = `
                SELECT cm.id AS class_module_id, cm.classroom_id, c.class_name,
                       cm.school_year_id, sy.name AS school_year_name,
                       sy.is_current AS school_year_is_current,
                       CASE WHEN cml.id IS NULL THEN 0 ELSE 1 END AS assigned
                FROM class_modules cm
                INNER JOIN classes c ON c.id = cm.classroom_id
                INNER JOIN school_years sy ON sy.id = cm.school_year_id
                LEFT JOIN class_module_lessons cml
                  ON cml.class_module_id = cm.id AND cml.lesson_id = ?
                WHERE cm.module_id = ?
                ORDER BY sy.start_date DESC, c.class_name ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [lessonId, moduleId]);
            return rows as LessonClassAssignmentRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async assign(id: Buffer, classModuleId: Buffer, lessonId: Buffer): Promise<void> {
        try {
            await this.connection.execute<ResultSetHeader>(
                `INSERT INTO class_module_lessons (id, class_module_id, lesson_id)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE id = id`,
                [id, classModuleId, lessonId]
            );
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async unassign(classModuleId: Buffer, lessonId: Buffer): Promise<void> {
        try {
            await this.connection.execute<ResultSetHeader>(
                `DELETE FROM class_module_lessons WHERE class_module_id = ? AND lesson_id = ?`,
                [classModuleId, lessonId]
            );
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async listForStudent(
        studentId: Buffer,
        schoolYearId: number | null
    ): Promise<StudentLessonRow[]> {
        try {
            const query = `
                SELECT cml.id AS assignment_id, ml.id AS lesson_id, m.id AS module_id,
                       m.title AS module_title, COALESCE(s.name, m.subject) AS subject_name,
                       f.first_name AS teacher_first_name, f.last_name AS teacher_last_name,
                       cm.classroom_id AS class_id, c.class_name,
                       cm.school_year_id, sy.name AS school_year_name,
                       ml.title, ml.lesson_type, ml.content, ml.file_name, ml.file_path,
                       ml.file_type, ml.file_size, ml.sort_order, cml.assigned_at
                FROM class_module_lessons cml
                INNER JOIN class_modules cm ON cm.id = cml.class_module_id
                INNER JOIN module_lessons ml ON ml.id = cml.lesson_id
                INNER JOIN modules m ON m.id = cm.module_id
                LEFT JOIN subjects s ON s.id = m.subject_id
                LEFT JOIN faculties f ON f.id = m.owner_faculty_id
                INNER JOIN classes c ON c.id = cm.classroom_id
                INNER JOIN school_years sy ON sy.id = cm.school_year_id
                INNER JOIN enrollments e
                  ON e.class_id = cm.classroom_id
                 AND e.school_year_id = cm.school_year_id
                 AND e.student_id = ?
                 AND e.status = 'active'
                WHERE (? IS NULL OR cm.school_year_id = ?)
                ORDER BY sy.start_date DESC, c.class_name ASC,
                         ml.sort_order ASC, ml.created_at ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [
                studentId,
                schoolYearId,
                schoolYearId,
            ]);
            return rows as StudentLessonRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getStudentLessonFile(
        studentId: Buffer,
        lessonId: Buffer
    ): Promise<StudentLessonFileRow | null> {
        try {
            const query = `
                SELECT ml.file_name, ml.file_path, ml.file_type
                FROM class_module_lessons cml
                INNER JOIN class_modules cm ON cm.id = cml.class_module_id
                INNER JOIN module_lessons ml ON ml.id = cml.lesson_id
                INNER JOIN enrollments e
                  ON e.class_id = cm.classroom_id
                 AND e.school_year_id = cm.school_year_id
                 AND e.student_id = ?
                 AND e.status = 'active'
                WHERE cml.lesson_id = ? AND ml.file_path IS NOT NULL
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [
                studentId,
                lessonId,
            ]);
            return (rows as StudentLessonFileRow[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
