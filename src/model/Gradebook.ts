import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { InternalServerError } from "../helper/error.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import type { GradingCategory, GradeItemCategory } from "../constant/gradebook.js";

export interface GradingWeightRow {
    id: number;
    class_id: Buffer;
    subject_id: Buffer;
    category: GradingCategory;
    weight: number;
    period_id: number | null;
}

export interface GradeItemRow {
    id: Buffer;
    class_id: Buffer;
    subject_id: Buffer;
    faculty_id: Buffer;
    category: GradeItemCategory;
    title: string;
    max_score: number;
    due_date: string | null;
    period_id: number | null;
    created_at: Date;
}

export interface GradeRow {
    id: number;
    grade_item_id: Buffer;
    student_id: Buffer;
    score: number;
    recorded_by: Buffer;
    recorded_at: Date;
}

export interface GradeWithStudentName extends GradeRow {
    student_name: string;
}

export interface GradeItemWithScores extends GradeItemRow {
    scores: { student_id: Buffer; student_name: string; score: number | null }[];
}

export interface FacultyAssignedClassSubject {
    class_id: Buffer;
    class_name: string;
    section: string | null;
    grade_level: string | null;
    subject_id: Buffer;
    subject_name: string;
}

export default class Gradebook {
    constructor(private connection: PoolConnection) {}

    async isTeacherAssignedToClassSubject(facultyId: Buffer, classId: Buffer, subjectId: Buffer): Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM class_faculties WHERE class_id = ? AND faculty_id = ? AND subject_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId, facultyId, subjectId]);
            return (row[0]?.cnt ?? 0) > 0;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async isStudentEnrolledInClass(studentId: Buffer, classId: Buffer, schoolYearId: number): Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM enrollments WHERE student_id = ? AND class_id = ? AND school_year_id = ? AND status = 'active'`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [studentId, classId, schoolYearId]);
            return (row[0]?.cnt ?? 0) > 0;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getFacultyAssignedClassSubjects(facultyId: Buffer, schoolId: number): Promise<FacultyAssignedClassSubject[]> {
        try {
            const query = `
                SELECT c.id as class_id, c.class_name, c.section, c.grade_level,
                       s.id as subject_id, s.name as subject_name
                FROM class_faculties cf
                INNER JOIN classes c ON c.id = cf.class_id
                INNER JOIN subjects s ON s.id = cf.subject_id
                WHERE cf.faculty_id = ? AND c.school_id = ? AND cf.subject_id IS NOT NULL
                ORDER BY c.class_name, s.name
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [facultyId, schoolId]);
            return rows as FacultyAssignedClassSubject[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    // --- Grading Weights ---

    async getGradingWeights(classId: Buffer, subjectId: Buffer, periodId?: number): Promise<GradingWeightRow[]> {
        try {
            let query = `SELECT id, class_id, subject_id, category, weight, period_id FROM grading_weights WHERE class_id = ? AND subject_id = ?`;
            const params: (Buffer | number)[] = [classId, subjectId];
            if (periodId !== undefined) {
                query += ` AND period_id = ?`;
                params.push(periodId);
            }
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, params);
            return rows as GradingWeightRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async upsertGradingWeights(classId: Buffer, subjectId: Buffer, weights: { category: GradingCategory; weight: number }[], periodId?: number): Promise<void> {
        try {
            for (const w of weights) {
                const query = `
                    INSERT INTO grading_weights (class_id, subject_id, category, weight, period_id)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE weight = VALUES(weight)
                `;
                await this.connection.execute<ResultSetHeader>(query, [classId, subjectId, w.category, w.weight, periodId ?? null]);
            }
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    // --- Grade Items ---

    async getGradeItems(classId: Buffer, subjectId: Buffer, category?: GradeItemCategory, periodId?: number): Promise<GradeItemRow[]> {
        try {
            let query = `SELECT id, class_id, subject_id, faculty_id, category, title, max_score, due_date, period_id, created_at FROM grade_items WHERE class_id = ? AND subject_id = ?`;
            const params: (Buffer | GradeItemCategory | number)[] = [classId, subjectId];
            if (category) {
                query += ` AND category = ?`;
                params.push(category);
            }
            if (periodId !== undefined) {
                query += ` AND period_id = ?`;
                params.push(periodId);
            }
            query += ` ORDER BY created_at DESC`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, params);
            return rows as GradeItemRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getGradeItemById(id: Buffer): Promise<GradeItemRow | null> {
        try {
            const query = `SELECT id, class_id, subject_id, faculty_id, category, title, max_score, due_date, created_at FROM grade_items WHERE id = ?`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            return (rows as GradeItemRow[])[0] || null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async createGradeItem(classId: Buffer, subjectId: Buffer, facultyId: Buffer, category: GradeItemCategory, title: string, maxScore: number, dueDate: string | null, periodId?: number): Promise<Buffer> {
        try {
            const idBuf = generateRandomUUID();
            const query = `INSERT INTO grade_items (id, class_id, subject_id, faculty_id, category, title, max_score, due_date, period_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            await this.connection.execute<ResultSetHeader>(query, [idBuf, classId, subjectId, facultyId, category, title, maxScore, dueDate || null, periodId ?? null]);
            return idBuf;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateGradeItem(id: Buffer, title: string, category: GradeItemCategory, maxScore: number, dueDate: string | null): Promise<void> {
        try {
            const query = `UPDATE grade_items SET title = ?, category = ?, max_score = ?, due_date = ? WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [title, category, maxScore, dueDate || null, id]);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteGradeItem(id: Buffer): Promise<void> {
        try {
            const query = `DELETE FROM grade_items WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async isGradeItemOwnedByFaculty(itemId: Buffer, facultyId: Buffer): Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM grade_items WHERE id = ? AND faculty_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [itemId, facultyId]);
            return (row[0]?.cnt ?? 0) > 0;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    // --- Grades ---

    async getGradesByGradeItem(gradeItemId: Buffer): Promise<GradeWithStudentName[]> {
        try {
            const query = `
                SELECT g.id, g.grade_item_id, g.student_id, g.score, g.recorded_by, g.recorded_at,
                       CONCAT(st.first_name, ' ', st.last_name) as student_name
                FROM grades g
                INNER JOIN students st ON st.id = g.student_id
                WHERE g.grade_item_id = ?
                ORDER BY st.last_name, st.first_name
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [gradeItemId]);
            return rows as GradeWithStudentName[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async upsertGrades(gradeItemId: Buffer, grades: { student_id: Buffer; score: number }[], recordedBy: Buffer): Promise<void> {
        try {
            for (const g of grades) {
                const query = `
                    INSERT INTO grades (grade_item_id, student_id, score, recorded_by)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE score = VALUES(score), recorded_by = VALUES(recorded_by)
                `;
                await this.connection.execute<ResultSetHeader>(query, [gradeItemId, g.student_id, g.score, recordedBy]);
            }
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getEnrolledStudentIds(classId: Buffer, schoolYearId: number): Promise<Buffer[]> {
        try {
            const query = `SELECT e.student_id FROM enrollments e WHERE e.class_id = ? AND e.school_year_id = ? AND e.status = 'active'`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [classId, schoolYearId]);
            return (rows as { student_id: Buffer }[]).map(r => r.student_id);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getEnrolledStudents(classId: Buffer, schoolYearId: number): Promise<{ student_id: Buffer; student_name: string; student_email: string; lrn: string | null }[]> {
        try {
            const query = `
                SELECT e.student_id,
                       CONCAT(st.first_name, ' ', st.last_name) as student_name,
                       st.email as student_email,
                       st.lrn
                FROM enrollments e
                INNER JOIN students st ON st.id = e.student_id
                WHERE e.class_id = ? AND e.school_year_id = ? AND e.status = 'active'
                ORDER BY st.last_name, st.first_name
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [classId, schoolYearId]);
            return rows as { student_id: Buffer; student_name: string; student_email: string; lrn: string | null }[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAttendanceRate(studentId: Buffer, classId: Buffer, subjectId: Buffer, periodId?: number): Promise<number> {
        try {
            let query = `
                SELECT
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count
                FROM attendance_records
                WHERE student_id = ? AND class_id = ? AND subject_id = ?
            `;
            const params: (Buffer | number)[] = [studentId, classId, subjectId];

            if (periodId !== undefined) {
                query += ` AND attendance_date BETWEEN (SELECT start_date FROM academic_periods WHERE id = ?) AND (SELECT end_date FROM academic_periods WHERE id = ?)`;
                params.push(periodId, periodId);
            }

            const [rows] = await this.connection.execute<RowDataPacket[]>(query, params);
            const row = rows[0];
            if (!row || row.total_sessions === 0) return 0;
            return Math.round((row.present_count / row.total_sessions) * 100);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async hasAttendanceRecords(studentId: Buffer, classId: Buffer, subjectId: Buffer, periodId?: number): Promise<boolean> {
        try {
            let query = `SELECT COUNT(*) as cnt FROM attendance_records WHERE student_id = ? AND class_id = ? AND subject_id = ?`;
            const params: (Buffer | number)[] = [studentId, classId, subjectId];

            if (periodId !== undefined) {
                query += ` AND attendance_date BETWEEN (SELECT start_date FROM academic_periods WHERE id = ?) AND (SELECT end_date FROM academic_periods WHERE id = ?)`;
                params.push(periodId, periodId);
            }

            const [rows] = await this.connection.execute<RowDataPacket[]>(query, params);
            return (rows[0]?.cnt ?? 0) > 0;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getStudentGradesForSubject(studentId: Buffer, classId: Buffer, subjectId: Buffer, periodId?: number): Promise<{
        items: { id: Buffer; category: GradeItemCategory; title: string; max_score: number; due_date: string | null }[];
        scores: { grade_item_id: Buffer; score: number }[];
    }> {
        try {
            let itemsQuery = `SELECT id, category, title, max_score, due_date FROM grade_items WHERE class_id = ? AND subject_id = ?`;
            const itemsParams: (Buffer | number)[] = [classId, subjectId];
            if (periodId !== undefined) {
                itemsQuery += ` AND period_id = ?`;
                itemsParams.push(periodId);
            }
            itemsQuery += ` ORDER BY category, created_at`;
            const [items] = await this.connection.execute<RowDataPacket[]>(itemsQuery, itemsParams);

            let scoresQuery = `SELECT grade_item_id, score FROM grades WHERE student_id = ? AND grade_item_id IN (SELECT id FROM grade_items WHERE class_id = ? AND subject_id = ?`;
            const scoresParams: (Buffer | number)[] = [studentId, classId, subjectId];
            if (periodId !== undefined) {
                scoresQuery += ` AND period_id = ?`;
                scoresParams.push(periodId);
            }
            scoresQuery += `)`;
            const [scores] = await this.connection.execute<RowDataPacket[]>(scoresQuery, scoresParams);

            return {
                items: items as { id: Buffer; category: GradeItemCategory; title: string; max_score: number; due_date: string | null }[],
                scores: scores as { grade_item_id: Buffer; score: number }[],
            };
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassSubjects(classId: Buffer): Promise<{ id: Buffer; name: string }[]> {
        try {
            const query = `
                SELECT DISTINCT s.id, s.name
                FROM class_faculties cf
                INNER JOIN subjects s ON s.id = cf.subject_id
                WHERE cf.class_id = ? AND cf.subject_id IS NOT NULL
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [classId]);
            return rows as { id: Buffer; name: string }[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSubjectTeacher(classId: Buffer, subjectId: Buffer): Promise<string | null> {
        try {
            const query = `
                SELECT CONCAT(f.first_name, ' ', f.last_name) as teacher_name
                FROM class_faculties cf
                INNER JOIN faculties f ON f.id = cf.faculty_id
                WHERE cf.class_id = ? AND cf.subject_id = ?
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [classId, subjectId]);
            return (rows[0]?.teacher_name as string) || null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
