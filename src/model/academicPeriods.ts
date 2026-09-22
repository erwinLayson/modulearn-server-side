import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { InternalServerError } from "../helper/error.js";
import type { AcademicPeriodProp, CreateAcademicPeriodProp } from "../constant/academicPeriods.js";

export default class AcademicPeriods {
    constructor(private connection: PoolConnection) {}

    async getBySchoolAndYear(schoolId: number, schoolYearId: number): Promise<AcademicPeriodProp[]> {
        try {
            const query = `
                SELECT id, school_id, school_year_id, name, period_number, start_date, end_date, is_current
                FROM academic_periods
                WHERE school_id = ? AND school_year_id = ?
                ORDER BY period_number ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [schoolId, schoolYearId]);
            return rows as AcademicPeriodProp[];
        } catch (err) {
            throw new InternalServerError("Error fetching academic periods", 500, err);
        }
    }

    async getCurrentBySchool(schoolId: number): Promise<AcademicPeriodProp | null> {
        try {
            const query = `
                SELECT ap.id, ap.school_id, ap.school_year_id, ap.name, ap.period_number,
                       ap.start_date, ap.end_date, ap.is_current
                FROM academic_periods ap
                INNER JOIN school_years sy ON sy.id = ap.school_year_id
                WHERE ap.school_id = ? AND ap.is_current = 1 AND sy.is_current = 1
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [schoolId]);
            return (rows as AcademicPeriodProp[])[0] || null;
        } catch (err) {
            throw new InternalServerError("Error fetching current academic period", 500, err);
        }
    }

    async getById(id: number): Promise<AcademicPeriodProp | null> {
        try {
            const query = `
                SELECT id, school_id, school_year_id, name, period_number, start_date, end_date, is_current
                FROM academic_periods WHERE id = ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            return (rows as AcademicPeriodProp[])[0] || null;
        } catch (err) {
            throw new InternalServerError("Error fetching academic period", 500, err);
        }
    }

    async create(period: CreateAcademicPeriodProp): Promise<number> {
        try {
            const query = `
                INSERT INTO academic_periods (school_id, school_year_id, name, period_number, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const [result] = await this.connection.execute<ResultSetHeader>(query, [
                period.school_id, period.school_year_id, period.name,
                period.period_number, period.start_date, period.end_date
            ]);
            return result.insertId;
        } catch (err) {
            throw new InternalServerError("Error creating academic period", 500, err);
        }
    }

    async update(id: number, data: { name?: string; start_date?: string; end_date?: string }): Promise<void> {
        try {
            const fields: string[] = [];
            const values: (string | number)[] = [];
            if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
            if (data.start_date !== undefined) { fields.push("start_date = ?"); values.push(data.start_date); }
            if (data.end_date !== undefined) { fields.push("end_date = ?"); values.push(data.end_date); }
            if (fields.length === 0) return;
            values.push(id);
            const query = `UPDATE academic_periods SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch (err) {
            throw new InternalServerError("Error updating academic period", 500, err);
        }
    }

    async delete(id: number): Promise<void> {
        try {
            const query = `DELETE FROM academic_periods WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch (err) {
            throw new InternalServerError("Error deleting academic period", 500, err);
        }
    }

    async setCurrent(schoolId: number, schoolYearId: number, periodId: number): Promise<void> {
        try {
            await this.connection.beginTransaction();
            const resetQuery = `UPDATE academic_periods SET is_current = 0 WHERE school_id = ? AND school_year_id = ?`;
            await this.connection.execute<ResultSetHeader>(resetQuery, [schoolId, schoolYearId]);
            const setQuery = `UPDATE academic_periods SET is_current = 1 WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(setQuery, [periodId]);
            await this.connection.commit();
        } catch (err) {
            await this.connection.rollback();
            throw new InternalServerError("Error setting current academic period", 500, err);
        }
    }

    async countBySchoolAndYear(schoolId: number, schoolYearId: number): Promise<number> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM academic_periods WHERE school_id = ? AND school_year_id = ?`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [schoolId, schoolYearId]);
            return (rows[0]?.cnt ?? 0) as number;
        } catch (err) {
            throw new InternalServerError("Error counting academic periods", 500, err);
        }
    }

    async countRecordsByPeriod(periodId: number, schoolId: number): Promise<{ gradeItems: number; attendance: number }> {
        try {
            const giQuery = `
                SELECT COUNT(*) as cnt FROM grade_items gi
                INNER JOIN classes c ON c.id = gi.class_id
                WHERE gi.period_id = ? AND c.school_id = ?
            `;
            const [giRows] = await this.connection.execute<RowDataPacket[]>(giQuery, [periodId, schoolId]);
            const gradeItems = (giRows[0]?.cnt ?? 0) as number;

            const period = await this.getById(periodId);
            let attendance = 0;
            if (period) {
                const attQuery = `
                    SELECT COUNT(*) as cnt FROM attendance_records ar
                    INNER JOIN classes c ON c.id = ar.class_id
                    WHERE c.school_id = ? AND ar.attendance_date BETWEEN ? AND ?
                `;
                const [attRows] = await this.connection.execute<RowDataPacket[]>(attQuery, [
                    schoolId, period.start_date, period.end_date
                ]);
                attendance = (attRows[0]?.cnt ?? 0) as number;
            }

            return { gradeItems, attendance };
        } catch (err) {
            throw new InternalServerError("Error counting period records", 500, err);
        }
    }

    async checkOverlap(schoolId: number, schoolYearId: number, startDate: string, endDate: string, excludeId?: number): Promise<boolean> {
        try {
            let query = `
                SELECT COUNT(*) as cnt FROM academic_periods
                WHERE school_id = ? AND school_year_id = ?
                AND start_date <= ? AND end_date >= ?
            `;
            const params: (number | string)[] = [schoolId, schoolYearId, endDate, startDate];
            if (excludeId !== undefined) {
                query += ` AND id != ?`;
                params.push(excludeId);
            }
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, params);
            return ((rows[0]?.cnt ?? 0) as number) > 0;
        } catch (err) {
            throw new InternalServerError("Error checking period overlap", 500, err);
        }
    }

    async existsBySchoolAndYear(schoolId: number, schoolYearId: number, periodNumber: number): Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM academic_periods WHERE school_id = ? AND school_year_id = ? AND period_number = ?`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [schoolId, schoolYearId, periodNumber]);
            return ((rows[0]?.cnt ?? 0) as number) > 0;
        } catch (err) {
            throw new InternalServerError("Error checking period existence", 500, err);
        }
    }

    async nameExistsBySchoolAndYear(schoolId: number, schoolYearId: number, name: string, excludeId?: number): Promise<boolean> {
        try {
            let query = `SELECT COUNT(*) as cnt FROM academic_periods WHERE school_id = ? AND school_year_id = ? AND name = ?`;
            const params: (number | string)[] = [schoolId, schoolYearId, name];
            if (excludeId !== undefined) {
                query += ` AND id != ?`;
                params.push(excludeId);
            }
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, params);
            return ((rows[0]?.cnt ?? 0) as number) > 0;
        } catch (err) {
            throw new InternalServerError("Error checking period name", 500, err);
        }
    }
}
