import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import {InternalServerError} from "../helper/error.js";

export interface AttendanceRecord {
    student_id: Buffer;
    subject_id: Buffer;
    status: "present" | "absent";
    recorded_at: Date;
    marked_by: Buffer;
}

export interface AttendanceRecordWithClass extends AttendanceRecord {
    class_id: Buffer;
}

export interface AttendanceHistoryItem {
    attendance_date: string;
    class_id: Buffer;
    class_name: string;
    subject_id: Buffer;
    subject_name: string;
    present_count: number;
    absent_count: number;
    total_count: number;
}

export interface FacultyDashboardSummary {
    today: {
        classes_with_attendance: number;
        classes_pending: number;
        total_classes_today: number;
    };
    this_week: {
        total_sessions: number;
        total_present: number;
        total_absent: number;
        attendance_rate: number;
    };
}

export interface StudentSubjectAttendance {
    subject_id: Buffer;
    subject_name: string;
    class_id: Buffer;
    class_name: string;
    teacher_name: string;
    total_sessions: number;
    present_count: number;
    absent_count: number;
    attendance_rate: number;
}

export interface StudentAttendanceDetail {
    attendance_date: string;
    status: "present" | "absent";
    recorded_at: Date;
    marked_by: Buffer;
    teacher_name: string;
}

export interface SchoolAttendanceReportItem {
    class_id: Buffer;
    class_name: string;
    section: string | null;
    grade_level: string | null;
    subject_id: Buffer;
    subject_name: string;
    teacher_id: Buffer;
    teacher_name: string;
    student_id: Buffer;
    student_name: string;
    attendance_date: string;
    status: "present" | "absent";
    recorded_at: Date;
    marked_by: Buffer;
    marked_by_name: string;
}

export interface SchoolAttendanceMatrixItem {
    class_id: Buffer;
    class_name: string;
    section: string | null;
    grade_level: string | null;
    subject_id: Buffer;
    subject_name: string;
    teacher_id: Buffer | null;
    teacher_name: string | null;
    total_enrolled: number;
    attendance_date: string;
    present_count: number;
    absent_count: number;
    marked_count: number;
}

export default class Attendance {
    constructor(private connection: PoolConnection){}

    async upsertAttendance(
        classId: Buffer,
        studentId: Buffer,
        subjectId: Buffer,
        status: "present" | "absent",
        markedBy: Buffer,
        attendanceDate: string,
        recordedAt: Date
    ):Promise<void> {
        try {
            const query = `
                INSERT INTO attendance_records(class_id, student_id, subject_id, attendance_date, status, marked_by, recorded_at)
                VALUES(?,?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by), recorded_at = VALUES(recorded_at)
            `;
            await this.connection.execute<ResultSetHeader>(query, [classId, studentId, subjectId, attendanceDate, status, markedBy, recordedAt]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAttendanceByClassAndDate(
        classId: Buffer,
        attendanceDate: string,
        subjectId?: Buffer
    ):Promise<AttendanceRecord[]> {
        try {
            let query = `
                SELECT student_id, subject_id, status, recorded_at, marked_by
                FROM attendance_records
                WHERE class_id = ? AND attendance_date = ?
            `;
            const params: (Buffer | string)[] = [classId, attendanceDate];

            if (subjectId) {
                query += ` AND subject_id = ?`;
                params.push(subjectId);
            }

            const [row] = await this.connection.execute<RowDataPacket[]>(query, params);
            return row as AttendanceRecord[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async hasExistingAttendance(
        classId: Buffer,
        subjectId: Buffer,
        attendanceDate: string
    ):Promise<boolean> {
        try {
            const query = `
                SELECT COUNT(*) as cnt FROM attendance_records
                WHERE class_id = ? AND subject_id = ? AND attendance_date = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId, subjectId, attendanceDate]);
            return (row[0]?.cnt ?? 0) > 0;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAttendanceHistory(
        filters: {
            classId?: Buffer;
            subjectId?: Buffer;
            studentId?: Buffer;
            teacherId?: Buffer;
            schoolId?: number;
            dateFrom?: string;
            dateTo?: string;
        },
        page: number = 1,
        limit: number = 50
    ):Promise<{data: AttendanceHistoryItem[]; total: number}> {
        try {
            const conditions: string[] = [];
            const params: (Buffer | number | string)[] = [];

            if (filters.classId) {
                conditions.push(`ar.class_id = ?`);
                params.push(filters.classId);
            }
            if (filters.subjectId) {
                conditions.push(`ar.subject_id = ?`);
                params.push(filters.subjectId);
            }
            if (filters.studentId) {
                conditions.push(`ar.student_id = ?`);
                params.push(filters.studentId);
            }
            if (filters.teacherId) {
                conditions.push(`cf.faculty_id = ?`);
                params.push(filters.teacherId);
            }
            if (filters.schoolId) {
                conditions.push(`c.school_id = ?`);
                params.push(filters.schoolId);
            }
            if (filters.dateFrom) {
                conditions.push(`ar.attendance_date >= ?`);
                params.push(filters.dateFrom);
            }
            if (filters.dateTo) {
                conditions.push(`ar.attendance_date <= ?`);
                params.push(filters.dateTo);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

            // Count total
            const countQuery = `
                SELECT COUNT(DISTINCT ar.class_id, ar.subject_id, ar.attendance_date) as total
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                LEFT JOIN class_faculties cf ON cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id
                ${whereClause}
            `;
            const [countRow] = await this.connection.execute<RowDataPacket[]>(countQuery, params);
            const total = countRow[0]?.total ?? 0;

            // Get paginated data
            const offset = (page - 1) * limit;
            const dataQuery = `
                SELECT 
                    DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
                    ar.class_id,
                    c.class_name,
                    ar.subject_id,
                    s.name as subject_name,
                    SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
                    SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                    COUNT(*) as total_count
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                INNER JOIN subjects s ON s.id = ar.subject_id
                LEFT JOIN class_faculties cf ON cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id
                ${whereClause}
                GROUP BY ar.class_id, ar.subject_id, DATE_FORMAT(ar.attendance_date, '%Y-%m-%d')
                ORDER BY ar.attendance_date DESC, ar.class_id, ar.subject_id
                LIMIT ? OFFSET ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(dataQuery, [...params, limit, offset]);
            return {data: rows as AttendanceHistoryItem[], total};
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getFacultyDashboardSummary(
        facultyId: Buffer,
        schoolId: number
    ):Promise<FacultyDashboardSummary> {
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            const weekStartStr = weekStart.toISOString().split('T')[0];
            const weekEndStr = todayStr;

            // Get classes teacher teaches today (based on schedule or all assigned classes)
            // For now, get all assigned classes for this teacher
            const classQuery = `
                SELECT DISTINCT c.id, c.class_name, cf.subject_id, s.name as subject_name
                FROM classes c
                INNER JOIN class_faculties cf ON cf.class_id = c.id
                INNER JOIN subjects s ON s.id = cf.subject_id
                WHERE cf.faculty_id = ? AND c.school_id = ?
            `;
            const [assignedClasses] = await this.connection.execute<RowDataPacket[]>(classQuery, [facultyId, schoolId]);

            // Today's attendance: classes with attendance recorded vs pending
            const todayClassesQuery: string = `
                SELECT DISTINCT ar.class_id, ar.subject_id
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                WHERE ar.attendance_date = ? AND c.school_id = ?
                AND EXISTS (
                    SELECT 1 FROM class_faculties cf 
                    WHERE cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id AND cf.faculty_id = ?
                )
            `;
            const [todayAttendance] = await this.connection.execute<RowDataPacket[]>(todayClassesQuery, [todayStr, schoolId, facultyId] as any[]);
            const classesWithAttendanceToday = new Set(todayAttendance.map(r => `${bufferToUUID(r.class_id)}-${bufferToUUID(r.subject_id)}`));
            const totalClassesToday = assignedClasses.length;

            // This week summary
            const weekQuery: string = `
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as total_present,
                    SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as total_absent
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                WHERE ar.attendance_date BETWEEN ? AND ?
                AND c.school_id = ?
                AND EXISTS (
                    SELECT 1 FROM class_faculties cf 
                    WHERE cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id AND cf.faculty_id = ?
                )
            `;
            const [weekResult] = await this.connection.execute<RowDataPacket[]>(weekQuery, [weekStartStr, weekEndStr, schoolId, facultyId] as any[]);
            const weekData = weekResult[0];

            const totalSessions = Number(weekData?.total_sessions ?? 0);
            const totalPresent = Number(weekData?.total_present ?? 0);
            const totalAbsent = Number(weekData?.total_absent ?? 0);
            const attendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

            return {
                today: {
                    classes_with_attendance: classesWithAttendanceToday.size,
                    classes_pending: totalClassesToday - classesWithAttendanceToday.size,
                    total_classes_today: totalClassesToday,
                },
                this_week: {
                    total_sessions: totalSessions,
                    total_present: totalPresent,
                    total_absent: totalAbsent,
                    attendance_rate: attendanceRate,
                },
            };
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getStudentAttendanceBySubject(
        studentId: Buffer,
        schoolId: number,
        schoolYearId?: number
    ):Promise<StudentSubjectAttendance[]> {
        try {
            // Get student's enrolled classes for the school year
            let classQuery = `
                SELECT DISTINCT c.id, c.class_name, c.section, c.grade_level, cf.subject_id, s.name as subject_name,
                       CONCAT(f.first_name, ' ', f.last_name) as teacher_name
                FROM classes c
                INNER JOIN class_faculties cf ON cf.class_id = c.id
                INNER JOIN subjects s ON s.id = cf.subject_id
                INNER JOIN faculties f ON f.id = cf.faculty_id
                WHERE c.school_id = ?
            `;
            const classParams: (number | Buffer)[] = [schoolId];

            if (schoolYearId) {
                classQuery += ` AND EXISTS (
                    SELECT 1 FROM enrollments e 
                    WHERE e.class_id = c.id AND e.student_id = ? AND e.school_year_id = ?
                )`;
                classParams.push(studentId, schoolYearId);
            } else {
                // Get current school year
                const syQuery = `SELECT id FROM school_years WHERE school_id = ? AND is_current = 1 LIMIT 1`;
                const [syRows] = await this.connection.execute<RowDataPacket[]>(syQuery, [schoolId]);
                const currentSyId = syRows[0]?.id;
                if (currentSyId) {
                    classQuery += ` AND EXISTS (
                        SELECT 1 FROM enrollments e 
                        WHERE e.class_id = c.id AND e.student_id = ? AND e.school_year_id = ?
                    )`;
                    classParams.push(studentId, currentSyId);
                }
            }

            const [enrolledClasses] = await this.connection.execute<RowDataPacket[]>(classQuery, classParams);

            if (enrolledClasses.length === 0) {
                return [];
            }

            // Get attendance for each subject
            const results: StudentSubjectAttendance[] = [];
            for (const cls of enrolledClasses) {
                const attendQuery = `
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
                        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
                    FROM attendance_records
                    WHERE student_id = ? AND class_id = ? AND subject_id = ?
                `;
                const [attendResult] = await this.connection.execute<RowDataPacket[]>(attendQuery, [studentId, cls.id, cls.subject_id]);
                const attend = attendResult[0];

                const totalSessions = Number(attend?.total_sessions ?? 0);
                const presentCount = Number(attend?.present_count ?? 0);
                const absentCount = Number(attend?.absent_count ?? 0);
                const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

                results.push({
                    subject_id: cls.subject_id,
                    subject_name: cls.subject_name,
                    class_id: cls.id,
                    class_name: cls.class_name,
                    teacher_name: cls.teacher_name,
                    total_sessions: totalSessions,
                    present_count: presentCount,
                    absent_count: absentCount,
                    attendance_rate: attendanceRate,
                });
            }

            return results;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getStudentAttendanceDetail(
        studentId: Buffer,
        classId: Buffer,
        subjectId: Buffer,
        dateFrom?: string,
        dateTo?: string,
        page: number = 1,
        limit: number = 50
    ):Promise<{data: StudentAttendanceDetail[]; total: number}> {
        try {
            const conditions: string[] = [`ar.student_id = ?`, `ar.class_id = ?`, `ar.subject_id = ?`];
            const params: (Buffer | string)[] = [studentId, classId, subjectId];

            if (dateFrom) {
                conditions.push(`ar.attendance_date >= ?`);
                params.push(dateFrom);
            }
            if (dateTo) {
                conditions.push(`ar.attendance_date <= ?`);
                params.push(dateTo);
            }

            const whereClause = conditions.join(" AND ");

            const countQuery = `SELECT COUNT(*) as total FROM attendance_records ar WHERE ${whereClause}`;
            const [countRow] = await this.connection.execute<RowDataPacket[]>(countQuery, params);
            const total = countRow[0]?.total ?? 0;

            const offset = (page - 1) * limit;
            const dataQuery = `
                SELECT 
                    DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
                    ar.status,
                    ar.recorded_at,
                    ar.marked_by,
                    CONCAT(f.first_name, ' ', f.last_name) as teacher_name
                FROM attendance_records ar
                INNER JOIN faculties f ON f.id = ar.marked_by
                WHERE ${whereClause}
                ORDER BY ar.attendance_date DESC, ar.recorded_at DESC
                LIMIT ? OFFSET ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(dataQuery, [...params, limit, offset]);
            return {data: rows as StudentAttendanceDetail[], total};
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSchoolAttendanceReport(
        schoolId: number,
        filters: {
            classId?: Buffer;
            subjectId?: Buffer;
            teacherId?: Buffer;
            studentId?: Buffer;
            dateFrom?: string;
            dateTo?: string;
        },
        page: number = 1,
        limit: number = 50
    ):Promise<{data: SchoolAttendanceReportItem[]; total: number}> {
        try {
            const conditions: string[] = [`c.school_id = ?`];
            const params: (number | Buffer | string)[] = [schoolId];

            if (filters.classId) {
                conditions.push(`ar.class_id = ?`);
                params.push(filters.classId);
            }
            if (filters.subjectId) {
                conditions.push(`ar.subject_id = ?`);
                params.push(filters.subjectId);
            }
            if (filters.teacherId) {
                conditions.push(`cf.faculty_id = ?`);
                params.push(filters.teacherId);
            }
            if (filters.studentId) {
                conditions.push(`ar.student_id = ?`);
                params.push(filters.studentId);
            }
            if (filters.dateFrom) {
                conditions.push(`ar.attendance_date >= ?`);
                params.push(filters.dateFrom);
            }
            if (filters.dateTo) {
                conditions.push(`ar.attendance_date <= ?`);
                params.push(filters.dateTo);
            }

            const whereClause = conditions.join(" AND ");

            const countQuery = `
                SELECT COUNT(*) as total
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                LEFT JOIN class_faculties cf ON cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id
                WHERE ${whereClause}
            `;
            const [countRow] = await this.connection.execute<RowDataPacket[]>(countQuery, params);
            const total = countRow[0]?.total ?? 0;

            const offset = (page - 1) * limit;
            const dataQuery = `
                SELECT 
                    ar.class_id,
                    c.class_name,
                    c.section,
                    c.grade_level,
                    ar.subject_id,
                    s.name as subject_name,
                    cf.faculty_id as teacher_id,
                    CONCAT(tf.first_name, ' ', tf.last_name) as teacher_name,
                    ar.student_id,
                    CONCAT(st.first_name, ' ', st.last_name) as student_name,
                    DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
                    ar.status,
                    ar.recorded_at,
                    ar.marked_by,
                    CONCAT(mf.first_name, ' ', mf.last_name) as marked_by_name
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                INNER JOIN subjects s ON s.id = ar.subject_id
                LEFT JOIN class_faculties cf ON cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id
                LEFT JOIN faculties tf ON tf.id = cf.faculty_id
                INNER JOIN students st ON st.id = ar.student_id
                INNER JOIN faculties mf ON mf.id = ar.marked_by
                WHERE ${whereClause}
                ORDER BY ar.attendance_date DESC, ar.recorded_at DESC
                LIMIT ? OFFSET ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(dataQuery, [...params, limit, offset]);
            return {data: rows as SchoolAttendanceReportItem[], total};
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSchoolAttendanceMatrix(
        schoolId: number,
        dateFrom: string,
        dateTo: string,
        schoolYearId: number,
        filters: {
            classId?: Buffer;
            subjectId?: Buffer;
            teacherId?: Buffer;
            gradeLevel?: string;
        }
    ): Promise<SchoolAttendanceMatrixItem[]> {
        try {
            const outerConditions: string[] = [];
            const outerParams: (number | Buffer | string)[] = [];

            if (filters.classId) {
                outerConditions.push(`agg.class_id = ?`);
                outerParams.push(filters.classId);
            }
            if (filters.subjectId) {
                outerConditions.push(`agg.subject_id = ?`);
                outerParams.push(filters.subjectId);
            }
            if (filters.teacherId) {
                outerConditions.push(`cf.faculty_id = ?`);
                outerParams.push(filters.teacherId);
            }
            if (filters.gradeLevel) {
                outerConditions.push(`c.grade_level = ?`);
                outerParams.push(filters.gradeLevel);
            }
            const outerWhere = outerConditions.length > 0 ? `AND ${outerConditions.join(" AND ")}` : "";

            const query = `
                SELECT
                    agg.class_id, c.class_name, c.section, c.grade_level,
                    agg.subject_id, s.name as subject_name,
                    cf.faculty_id as teacher_id,
                    CONCAT(tf.first_name, ' ', tf.last_name) as teacher_name,
                    agg.total_enrolled,
                    DATE_FORMAT(agg.attendance_date, '%Y-%m-%d') as attendance_date,
                    agg.present_count,
                    agg.absent_count,
                    agg.marked_count
                FROM (
                    SELECT
                        ar.class_id, ar.subject_id, ar.attendance_date,
                        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
                        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                        COUNT(*) as marked_count,
                        (SELECT COUNT(*) FROM enrollments e
                          WHERE e.class_id = ar.class_id AND e.school_year_id = ? AND e.status = 'active') as total_enrolled
                    FROM attendance_records ar
                    INNER JOIN classes c ON c.id = ar.class_id
                    WHERE c.school_id = ? AND ar.attendance_date BETWEEN ? AND ?
                    GROUP BY ar.class_id, ar.subject_id, ar.attendance_date
                ) agg
                INNER JOIN classes c ON c.id = agg.class_id
                INNER JOIN subjects s ON s.id = agg.subject_id
                LEFT JOIN class_faculties cf ON cf.class_id = agg.class_id AND cf.subject_id = agg.subject_id
                LEFT JOIN faculties tf ON tf.id = cf.faculty_id
                WHERE 1 = 1 ${outerWhere}
                ORDER BY c.grade_level, c.section, c.class_name, s.name, agg.attendance_date
            `;
            // Placeholder order: subquery school_year_id, then inner WHERE, then outer filters
            const [rows] = await this.connection.execute<RowDataPacket[]>(
                query,
                [schoolYearId, schoolId, dateFrom, dateTo, ...outerParams]
            );
            return rows as SchoolAttendanceMatrixItem[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAllStudentAttendanceRecords(
        studentId: Buffer,
        schoolId: number,
        filters: {
            subjectId?: Buffer;
            dateFrom?: string;
            dateTo?: string;
        },
        page: number = 1,
        limit: number = 50
    ):Promise<{data: {subject_id: Buffer; subject_name: string; class_name: string; teacher_name: string; attendance_date: string; status: "present" | "absent"}[]; total: number}> {
        try {
            const conditions: string[] = [`ar.student_id = ?`];
            const params: (Buffer | number | string)[] = [studentId];

            // Only get records from classes the student is enrolled in
            conditions.push(`EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.class_id = ar.class_id AND e.student_id = ar.student_id
            )`);

            if (filters.subjectId) {
                conditions.push(`ar.subject_id = ?`);
                params.push(filters.subjectId);
            }
            if (filters.dateFrom) {
                conditions.push(`ar.attendance_date >= ?`);
                params.push(filters.dateFrom);
            }
            if (filters.dateTo) {
                conditions.push(`ar.attendance_date <= ?`);
                params.push(filters.dateTo);
            }

            const whereClause = conditions.join(" AND ");

            const countQuery = `SELECT COUNT(*) as total FROM attendance_records ar WHERE ${whereClause}`;
            const [countRow] = await this.connection.execute<RowDataPacket[]>(countQuery, params);
            const total = countRow[0]?.total ?? 0;

            const offset = (page - 1) * limit;
            const dataQuery = `
                SELECT
                    ar.subject_id,
                    s.name as subject_name,
                    c.class_name,
                    CONCAT(f.first_name, ' ', f.last_name) as teacher_name,
                    DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
                    ar.status
                FROM attendance_records ar
                INNER JOIN subjects s ON s.id = ar.subject_id
                INNER JOIN classes c ON c.id = ar.class_id
                LEFT JOIN class_faculties cf ON cf.class_id = ar.class_id AND cf.subject_id = ar.subject_id
                LEFT JOIN faculties f ON f.id = cf.faculty_id
                WHERE ${whereClause}
                ORDER BY ar.attendance_date DESC, s.name ASC
                LIMIT ? OFFSET ?
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(dataQuery, [...params, limit, offset]);
            return {data: rows as {subject_id: Buffer; subject_name: string; class_name: string; teacher_name: string; attendance_date: string; status: "present" | "absent"}[], total};
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassSchoolId(classId: Buffer):Promise<{school_id: number} | null> {
        try {
            const query = `SELECT school_id FROM classes WHERE id = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId]);
            if(row.length === 0) { return null; }
            return row[0] as {school_id: number};
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async isTeacherAssignedToClass(facultyId: Buffer, classId: Buffer):Promise<boolean> {
        try {
            const query = `
                SELECT COUNT(*) as cnt FROM (
                    SELECT id FROM classes WHERE id = ? AND faculty_id = ?
                    UNION ALL
                    SELECT c.id FROM classes c
                    INNER JOIN class_faculties cf ON cf.class_id = c.id
                    WHERE c.id = ? AND cf.faculty_id = ?
                ) as assignments
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId, facultyId, classId, facultyId]);
            const count = row[0]?.cnt ?? 0;
            return count > 0;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async isTeacherAssignedToClassSubject(facultyId: Buffer, classId: Buffer, subjectId: Buffer):Promise<boolean> {
        try {
            const query = `
                SELECT COUNT(*) as cnt FROM class_faculties
                WHERE class_id = ? AND faculty_id = ? AND subject_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId, facultyId, subjectId]);
            const count = row[0]?.cnt ?? 0;
            return count > 0;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async createSession(
        classId: Buffer,
        subjectId: Buffer,
        attendanceDate: string,
        createdBy: Buffer
    ): Promise<void> {
        try {
            const query = `
                INSERT INTO attendance_sessions(class_id, subject_id, attendance_date, created_by)
                VALUES(?, ?, ?, ?)
            `;
            await this.connection.execute<ResultSetHeader>(query, [classId, subjectId, attendanceDate, createdBy]);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async sessionExists(
        classId: Buffer,
        subjectId: Buffer,
        attendanceDate: string
    ): Promise<boolean> {
        try {
            const query = `
                SELECT COUNT(*) as cnt FROM attendance_sessions
                WHERE class_id = ? AND subject_id = ? AND attendance_date = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId, subjectId, attendanceDate]);
            return (row[0]?.cnt ?? 0) > 0;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSessionsByClass(classId: Buffer): Promise<{ attendance_date: string; subject_id: Buffer; subject_name: string }[]> {
        try {
            const query = `
                SELECT DATE_FORMAT(ast.attendance_date, '%Y-%m-%d') as attendance_date,
                       ast.subject_id,
                       s.name as subject_name
                FROM attendance_sessions ast
                INNER JOIN subjects s ON s.id = ast.subject_id
                WHERE ast.class_id = ?
                ORDER BY ast.attendance_date DESC, s.name
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [classId]);
            return rows as { attendance_date: string; subject_id: Buffer; subject_name: string }[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAttendanceBySchoolAndDate(
        schoolId: number,
        attendanceDate: Date,
        subjectId?: Buffer
    ):Promise<AttendanceRecordWithClass[]> {
        try {
            let query = `
                SELECT ar.class_id, ar.student_id, ar.subject_id, ar.status, ar.recorded_at, ar.marked_by
                FROM attendance_records ar
                INNER JOIN classes c ON c.id = ar.class_id
                WHERE c.school_id = ? AND ar.attendance_date = ?
            `;
            const params: (number | Date | Buffer)[] = [schoolId, attendanceDate];

            if (subjectId) {
                query += ` AND ar.subject_id = ?`;
                params.push(subjectId);
            }

            const [row] = await this.connection.execute<RowDataPacket[]>(query, params);
            return row as AttendanceRecordWithClass[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}

// Helper function
function bufferToUUID(buf: Buffer): string {
    return buf.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}