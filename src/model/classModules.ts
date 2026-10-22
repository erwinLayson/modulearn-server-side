import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
    ClassModuleAssignmentRow,
    ClassModuleDetailRow,
    ClassModuleWithModuleRow,
    EligibleClassroomRow,
} from "../constant/classModules.js";
import { InternalServerError } from "../helper/error.js";

export default class ClassModule {
    constructor(private connection: PoolConnection) {}

    async createAssignment(
        id: Buffer,
        moduleId: Buffer,
        classroomId: Buffer,
        schoolYearId: number
    ): Promise<void> {
        try {
            await this.connection.execute<ResultSetHeader>(
                `INSERT INTO class_modules (id, module_id, classroom_id, school_year_id) VALUES (?,?,?,?)`,
                [id, moduleId, classroomId, schoolYearId]
            );
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getById(id: Buffer): Promise<{
        id: Buffer;
        module_id: Buffer;
        classroom_id: Buffer;
        school_year_id: number;
        assigned_at: Date;
    } | null> {
        try {
            const [rows] = await this.connection.execute<RowDataPacket[]>(
                `SELECT id, module_id, classroom_id, school_year_id, assigned_at
                 FROM class_modules WHERE id = ? LIMIT 1`,
                [id]
            );
            return (rows as {
                id: Buffer;
                module_id: Buffer;
                classroom_id: Buffer;
                school_year_id: number;
                assigned_at: Date;
            }[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async findDuplicate(
        moduleId: Buffer,
        classroomId: Buffer,
        schoolYearId: number
    ): Promise<ClassModuleAssignmentRow | null> {
        try {
            const [rows] = await this.connection.execute<RowDataPacket[]>(
                `SELECT cm.id, cm.module_id, cm.classroom_id, c.class_name,
                        cm.school_year_id, sy.name AS school_year_name, cm.assigned_at
                 FROM class_modules cm
                 INNER JOIN classes c ON c.id = cm.classroom_id
                 INNER JOIN school_years sy ON sy.id = cm.school_year_id
                 WHERE cm.module_id = ? AND cm.classroom_id = ? AND cm.school_year_id = ?
                 LIMIT 1`,
                [moduleId, classroomId, schoolYearId]
            );
            return (rows as ClassModuleAssignmentRow[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async listByClassroomForTeacher(classroomId: Buffer, teacherId: Buffer): Promise<ClassModuleWithModuleRow[]> {
        try {
            const query = `
                SELECT cm.id, cm.module_id, cm.classroom_id, cm.school_year_id, cm.assigned_at,
                       m.title, m.description, m.lesson_content, m.subject_id,
                       COALESCE(s.name, m.subject) AS subject_name,
                       m.status, m.owner_faculty_id,
                       c.class_name, sy.name AS school_year_name
                FROM class_modules cm
                INNER JOIN modules m ON m.id = cm.module_id
                INNER JOIN classes c ON c.id = cm.classroom_id
                INNER JOIN school_years sy ON sy.id = cm.school_year_id
                LEFT JOIN subjects s ON s.id = m.subject_id
                WHERE cm.classroom_id = ?
                  AND (
                    m.owner_faculty_id = ?
                    OR EXISTS (
                      SELECT 1 FROM class_faculties cf
                      WHERE cf.class_id = cm.classroom_id
                        AND cf.faculty_id = ?
                        AND cf.subject_id = m.subject_id
                        AND cf.school_year_id = cm.school_year_id
                    )
                  )
                ORDER BY sy.start_date DESC, m.title ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [
                classroomId, teacherId, teacherId,
            ]);
            return rows as ClassModuleWithModuleRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getEligibleClassrooms(
        moduleId: Buffer,
        subjectId: Buffer,
        teacherId: Buffer,
        schoolId: number
    ): Promise<EligibleClassroomRow[]> {
        try {
            const query = `
                SELECT c.id AS classroom_id, c.class_name, c.section, c.grade_level,
                       c.school_year_id, sy.name AS school_year_name, cm.id AS class_module_id
                FROM classes c
                INNER JOIN school_years sy ON sy.id = c.school_year_id
                INNER JOIN class_faculties cf
                  ON cf.class_id = c.id
                 AND cf.faculty_id = ?
                 AND cf.subject_id = ?
                 AND cf.school_year_id = c.school_year_id
                LEFT JOIN class_modules cm
                  ON cm.module_id = ?
                 AND cm.classroom_id = c.id
                 AND cm.school_year_id = c.school_year_id
                WHERE c.school_id = ? AND c.is_active = 1
                ORDER BY sy.start_date DESC, c.class_name ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [
                teacherId, subjectId, moduleId, schoolId,
            ]);
            return rows as EligibleClassroomRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAssignmentWithModule(id: Buffer): Promise<ClassModuleDetailRow | null> {
        try {
            const query = `
                SELECT cm.id, cm.module_id, cm.classroom_id, cm.school_year_id, cm.assigned_at,
                       c.class_name, sy.name AS school_year_name,
                       m.title, m.description, m.lesson_content, m.subject_id,
                       COALESCE(s.name, m.subject) AS subject_name,
                       m.status, m.owner_faculty_id
                FROM class_modules cm
                INNER JOIN modules m ON m.id = cm.module_id
                INNER JOIN classes c ON c.id = cm.classroom_id
                INNER JOIN school_years sy ON sy.id = cm.school_year_id
                LEFT JOIN subjects s ON s.id = m.subject_id
                WHERE cm.id = ?
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            return (rows as ClassModuleDetailRow[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAssignmentsForModule(moduleId: Buffer): Promise<ClassModuleAssignmentRow[]> {
        try {
            const query = `
                SELECT cm.id, cm.module_id, cm.classroom_id, c.class_name,
                       cm.school_year_id, sy.name AS school_year_name, cm.assigned_at
                FROM class_modules cm
                INNER JOIN classes c ON c.id = cm.classroom_id
                INNER JOIN school_years sy ON sy.id = cm.school_year_id
                WHERE cm.module_id = ?
                ORDER BY sy.start_date DESC, c.class_name ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [moduleId]);
            return rows as ClassModuleAssignmentRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
