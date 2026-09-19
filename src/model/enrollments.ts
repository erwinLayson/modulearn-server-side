import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{EnrollmentProp} from "../constant/enrollments.js";
import {InternalServerError} from "../helper/error.js";

export default class Enrollment {
    constructor(private connection: PoolConnection){}

    async enrollStudent(enrollment: EnrollmentProp):Promise<Buffer> {
        const {id, student_id, class_id, school_year_id, grade_level, status} = enrollment;
        try {
            const query = `INSERT INTO enrollments(id, student_id, class_id, school_year_id, grade_level, status) VALUES(?,?,?,?,?,?)`;
            const values = [id, student_id, class_id, school_year_id, grade_level, status];
            await this.connection.execute<ResultSetHeader>(query, values);
            return id;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async addEnrollmentSubjects(enrollmentId: Buffer, subjectIds: Buffer[]):Promise<void> {
        if (subjectIds.length === 0) return;
        try {
            const placeholders = subjectIds.map(() => `(?, ?)`).join(", ");
            const values: Buffer[] = [];
            subjectIds.forEach(sid => { values.push(enrollmentId, sid); });
            const query = `INSERT INTO enrollment_subjects(enrollment_id, subject_id) VALUES ${placeholders}`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteEnrollmentSubjects(enrollmentId: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM enrollment_subjects WHERE enrollment_id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [enrollmentId]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getEnrollmentsByClassIdAndSchoolYear(classId: Buffer, schoolYearId: number):Promise<RowDataPacket[]> {
        try {
            const query = `
                SELECT 
                    e.id, e.student_id, e.class_id, e.school_year_id, e.status, e.enrolled_at,
                    CONCAT(s.first_name, ' ', s.last_name) as student_name,
                    s.email as student_email,
                    s.lrn,
                    c.class_name, c.section, e.grade_level,
                    sy.name as school_year_name
                FROM enrollments e
                INNER JOIN students s ON e.student_id = s.id
                INNER JOIN classes c ON e.class_id = c.id
                LEFT JOIN school_years sy ON e.school_year_id = sy.id
                WHERE e.class_id = ? AND e.school_year_id = ?
                ORDER BY e.enrolled_at DESC
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId, schoolYearId]);
            return row;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getEnrollmentsByStudentId(studentId: Buffer):Promise<RowDataPacket[]> {
        try {
            const query = `
                SELECT 
                    e.id, e.student_id, e.class_id, e.school_year_id, e.status, e.enrolled_at,
                    c.class_name, c.section, e.grade_level, c.capacity,
                    CONCAT(f.first_name, ' ', f.last_name) as adviser_name,
                    sy.name as school_year_name,
                    CONCAT(sadmin.first_name, ' ', sadmin.last_name) as school_name
                FROM enrollments e
                INNER JOIN classes c ON e.class_id = c.id
                LEFT JOIN faculties f ON c.faculty_id = f.id
                LEFT JOIN school_years sy ON e.school_year_id = sy.id
                LEFT JOIN schools sadmin ON c.school_id = sadmin.school_id
                WHERE e.student_id = ?
                ORDER BY e.enrolled_at DESC
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [studentId]);
            return row;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getEnrollmentsByStudentAndSchoolYear(studentId: Buffer, schoolYearId: number):Promise<RowDataPacket[]> {
        try {
            const query = `
                SELECT 
                    e.id, e.student_id, e.class_id, e.school_year_id, e.status, e.enrolled_at,
                    c.class_name, c.section, e.grade_level, c.capacity, c.schedule,
                    CONCAT(f.first_name, ' ', f.last_name) as adviser_name,
                    sy.name as school_year_name
                FROM enrollments e
                INNER JOIN classes c ON e.class_id = c.id
                LEFT JOIN faculties f ON c.faculty_id = f.id
                LEFT JOIN school_years sy ON e.school_year_id = sy.id
                WHERE e.student_id = ? AND e.school_year_id = ?
                LIMIT 1
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [studentId, schoolYearId]);
            return row;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSubjectsByEnrollmentId(enrollmentId: Buffer):Promise<RowDataPacket[]> {
        try {
            const query = `
                SELECT sub.id, sub.name,
                    CONCAT(f.first_name, ' ', f.last_name) as teacher_name
                FROM enrollment_subjects es
                INNER JOIN subjects sub ON es.subject_id = sub.id
                LEFT JOIN class_faculties cf ON cf.subject_id = sub.id AND cf.class_id = (
                    SELECT e.class_id FROM enrollments e WHERE e.id = es.enrollment_id
                )
                LEFT JOIN faculties f ON cf.faculty_id = f.id
                WHERE es.enrollment_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [enrollmentId]);
            return row;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async hasActiveEnrollmentInSchoolYear(studentId: Buffer, schoolYearId: number):Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM enrollments WHERE student_id = ? AND school_year_id = ? AND status = 'active'`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [studentId, schoolYearId]);
            const count = row[0]?.cnt ?? 0;
            return count > 0;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async hasDuplicateEnrollment(studentId: Buffer, classId: Buffer, schoolYearId: number):Promise<boolean> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM enrollments WHERE student_id = ? AND class_id = ? AND school_year_id = ? AND status IN ('active', 'completed')`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [studentId, classId, schoolYearId]);
            const count = row[0]?.cnt ?? 0;
            return count > 0;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getActiveEnrollmentCountByClassId(classId: Buffer):Promise<number> {
        try {
            const query = `SELECT COUNT(*) as cnt FROM enrollments WHERE class_id = ? AND status = 'active'`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId]);
            const count = row[0]?.cnt ?? 0;
            return count;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateEnrollmentStatus(id: Buffer, status: "active" | "dropped" | "completed"):Promise<void> {
        try {
            const query = `UPDATE enrollments SET status = ? WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [status, id]);
            if (status === "dropped" || status === "completed") {
                await this.deleteEnrollmentSubjects(id);
            }
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteEnrollment(id: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM enrollments WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
