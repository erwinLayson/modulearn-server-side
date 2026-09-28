import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { InternalServerError } from "../helper/error.js";

export interface FinalizationRow {
    id: number;
    school_id: number;
    school_year_id: number;
    period_id: number | null;
    class_id: Buffer;
    subject_id: Buffer;
    student_id: Buffer;
    final_grade: number | null;
    finalized_by: Buffer;
    finalized_at: Date;
    updated_by: Buffer | null;
    updated_at: Date | null;
    correction_reason: string | null;
}

export default class PeriodFinalizations {
    constructor(private connection: PoolConnection) {}

    async getForStudentClassSubject(
        studentId: Buffer,
        classId: Buffer,
        subjectId: Buffer
    ): Promise<FinalizationRow[]> {
        try {
            const query = `
                SELECT id, school_id, school_year_id, period_id, class_id, subject_id, student_id,
                       final_grade, finalized_by, finalized_at, updated_by, updated_at, correction_reason
                FROM period_finalizations
                WHERE student_id = ? AND class_id = ? AND subject_id = ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [studentId, classId, subjectId]);
            return rows as FinalizationRow[];
        } catch (err) {
            throw new InternalServerError("Error fetching period finalizations", 500, err);
        }
    }

    async getByPeriodClassSubject(
        periodId: number,
        classId: Buffer,
        subjectId: Buffer
    ): Promise<FinalizationRow[]> {
        try {
            const query = `
                SELECT id, school_id, school_year_id, period_id, class_id, subject_id, student_id,
                       final_grade, finalized_by, finalized_at, updated_by, updated_at, correction_reason
                FROM period_finalizations
                WHERE period_id = ? AND class_id = ? AND subject_id = ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [periodId, classId, subjectId]);
            return rows as FinalizationRow[];
        } catch (err) {
            throw new InternalServerError("Error fetching period finalizations", 500, err);
        }
    }

    async hasFinalizationsForClassSubject(classId: Buffer, subjectId: Buffer): Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM period_finalizations WHERE class_id = ? AND subject_id = ?`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [classId, subjectId]);
            return ((rows[0]?.cnt ?? 0) as number) > 0;
        } catch (err) {
            throw new InternalServerError("Error checking period finalizations", 500, err);
        }
    }

    async hasFinalizationForPeriod(periodId: number, classId: Buffer, subjectId: Buffer): Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM period_finalizations WHERE period_id = ? AND class_id = ? AND subject_id = ?`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [periodId, classId, subjectId]);
            return ((rows[0]?.cnt ?? 0) as number) > 0;
        } catch (err) {
            throw new InternalServerError("Error checking period finalization", 500, err);
        }
    }

    async upsert(data: {
        school_id: number;
        school_year_id: number;
        period_id: number | null;
        class_id: Buffer;
        subject_id: Buffer;
        student_id: Buffer;
        final_grade: number | null;
        finalized_by: Buffer;
    }): Promise<void> {
        try {
            if (data.period_id === null) {
                const [existingRows] = await this.connection.execute<RowDataPacket[]>(
                    `SELECT id FROM period_finalizations
                     WHERE period_id IS NULL AND class_id = ? AND subject_id = ? AND student_id = ?
                     LIMIT 1`,
                    [data.class_id, data.subject_id, data.student_id]
                );
                if (existingRows.length > 0) {
                    await this.connection.execute<ResultSetHeader>(
                        `UPDATE period_finalizations
                         SET final_grade = ?, finalized_by = ?, finalized_at = CURRENT_TIMESTAMP
                         WHERE period_id IS NULL AND class_id = ? AND subject_id = ? AND student_id = ?`,
                        [data.final_grade, data.finalized_by, data.class_id, data.subject_id, data.student_id]
                    );
                    return;
                }
            } else {
                const [existingRows] = await this.connection.execute<RowDataPacket[]>(
                    `SELECT id FROM period_finalizations
                     WHERE period_id = ? AND class_id = ? AND subject_id = ? AND student_id = ?
                     LIMIT 1`,
                    [data.period_id, data.class_id, data.subject_id, data.student_id]
                );
                if (existingRows.length > 0) {
                    await this.connection.execute<ResultSetHeader>(
                        `UPDATE period_finalizations
                         SET final_grade = ?, finalized_by = ?, finalized_at = CURRENT_TIMESTAMP
                         WHERE period_id = ? AND class_id = ? AND subject_id = ? AND student_id = ?`,
                        [data.final_grade, data.finalized_by, data.period_id, data.class_id, data.subject_id, data.student_id]
                    );
                    return;
                }
            }

            const query = `
                INSERT INTO period_finalizations
                    (school_id, school_year_id, period_id, class_id, subject_id, student_id, final_grade, finalized_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await this.connection.execute<ResultSetHeader>(query, [
                data.school_id,
                data.school_year_id,
                data.period_id,
                data.class_id,
                data.subject_id,
                data.student_id,
                data.final_grade,
                data.finalized_by,
            ]);
        } catch (err) {
            throw new InternalServerError("Error saving period finalization", 500, err);
        }
    }

    async correctFinalization(id: number, finalGrade: number | null, updatedBy: Buffer, reason: string): Promise<void> {
        try {
            const query = `
                UPDATE period_finalizations
                SET final_grade = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP, correction_reason = ?
                WHERE id = ?
            `;
            const [result] = await this.connection.execute<ResultSetHeader>(query, [finalGrade, updatedBy, reason, id]);
            if (result.affectedRows === 0) {
                throw new InternalServerError("Finalization not found", 404);
            }
        } catch (err) {
            throw err;
        }
    }
}
