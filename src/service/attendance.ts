import {databasePool} from "../config/database.js";
import AttendanceModel from "../model/attendance.js";
import type {AttendanceHistoryItem, FacultyDashboardSummary, StudentSubjectAttendance, StudentAttendanceDetail, SchoolAttendanceReportItem} from "../model/attendance.js";
import {NotFoundError, BadRequestError, ForbiddenError} from "../helper/error.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const markAttendanceService = async (
    classId: string,
    subjectId: string,
    records: { student_id: string; status: "present" | "absent" }[],
    markedBy: string,
    date: string | undefined
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        if (!subjectId || typeof subjectId !== "string") {
            throw new BadRequestError("subject_id is required");
        }
        if (!Array.isArray(records) || records.length === 0) {
            throw new BadRequestError("No attendance records provided");
        }
        if (date !== undefined && !DATE_ONLY.test(date)) {
            throw new BadRequestError("date must be in YYYY-MM-DD format");
        }
        for (const r of records) {
            if (!r || typeof r.student_id !== "string" || (r.status !== "present" && r.status !== "absent")) {
                throw new BadRequestError("Each record requires student_id and status of 'present' or 'absent'");
            }
        }

        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");

        const classModel = new (await import("../model/classes.js")).default(connection);
        const attendanceModel = new AttendanceModel(connection);

        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const classInfo = await classModel.getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }

        // School admins can manage attendance for any subject in their school
        // Faculty can only manage attendance for subjects they teach in the class
        const isSchoolAdmin = false; // Will be checked in controller via roleMiddleware
        const markedByBuf = UUIDToBuffer(markedBy);

        if (!isSchoolAdmin) {
            const assigned = await attendanceModel.isTeacherAssignedToClassSubject(markedByBuf, classBuf, subjectBuf);
            if (!assigned) {
                throw new ForbiddenError("You are not assigned to teach this subject in this class");
            }
        }

        // Validate date range: not in the future, not before the class existed
        const attendanceDate = date || new Date().toISOString().slice(0, 10);
        const targetDateObj = new Date(`${attendanceDate}T00:00:00`);
        const now = new Date();
        if (targetDateObj > now) {
            throw new BadRequestError("Cannot mark attendance for a future date");
        }
        if (classInfo.created_at && targetDateObj < new Date(classInfo.created_at)) {
            throw new BadRequestError("Date is before the class was created");
        }

        // Check for duplicate session (class_id + subject_id + attendance_date)
        const existing = await attendanceModel.hasExistingAttendance(classBuf, subjectBuf, attendanceDate);
        if (existing) {
            throw new BadRequestError(`Attendance for this subject on ${attendanceDate} already exists. Please use the edit endpoint to update existing attendance.`);
        }

        // All marked students must be actively enrolled in this class for the current school year
        const enrollmentModel = new (await import("../model/enrollments.js")).default(connection);
        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(classInfo.school_id);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set for this school");
        }
        const enrolled = await enrollmentModel.getEnrollmentsByClassIdAndSchoolYear(classBuf, currentSy.id);
        const enrolledIds = new Set(enrolled.map(e => bufferToUUID(e.student_id)));

        const invalid = records.filter(r => !enrolledIds.has(r.student_id));
        if (invalid.length > 0) {
            throw new BadRequestError("Some students are not enrolled in this class for the current school year");
        }

        const recordedAt = new Date();

        for (const r of records) {
            await attendanceModel.upsertAttendance(
                classBuf,
                UUIDToBuffer(r.student_id),
                subjectBuf,
                r.status,
                markedByBuf,
                attendanceDate,
                recordedAt
            );
        }

        return { saved: records.length };
    } finally {
        connection.release();
    }
};

export const createAttendanceSessionService = async (
    classId: string,
    subjectId: string,
    createdBy: string,
    date: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        if (!subjectId || typeof subjectId !== "string") {
            throw new BadRequestError("subject_id is required");
        }
        if (!DATE_ONLY.test(date)) {
            throw new BadRequestError("date must be in YYYY-MM-DD format");
        }

        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");

        const classModel = new (await import("../model/classes.js")).default(connection);
        const attendanceModel = new AttendanceModel(connection);

        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const classInfo = await classModel.getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }

        const createdByBuf = UUIDToBuffer(createdBy);

        // Faculty must be assigned to this subject in this class
        const assigned = await attendanceModel.isTeacherAssignedToClassSubject(createdByBuf, classBuf, subjectBuf);
        if (!assigned) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        // Validate date range: not in the future, not before the class existed
        const targetDateObj = new Date(`${date}T00:00:00`);
        const now = new Date();
        if (targetDateObj > now) {
            throw new BadRequestError("Cannot create attendance session for a future date");
        }
        if (classInfo.created_at && targetDateObj < new Date(classInfo.created_at)) {
            throw new BadRequestError("Date is before the class was created");
        }

        // Check for existing session in attendance_sessions
        const existing = await attendanceModel.sessionExists(classBuf, subjectBuf, date);
        if (existing) {
            throw new BadRequestError(`Attendance session for this subject on ${date} already exists`);
        }

        // Also check attendance_records for backward compatibility
        const existingRecords = await attendanceModel.hasExistingAttendance(classBuf, subjectBuf, date);
        if (existingRecords) {
            throw new BadRequestError(`Attendance records for this subject on ${date} already exist. Please use the edit endpoint to update.`);
        }

        await attendanceModel.createSession(classBuf, subjectBuf, date, createdByBuf);

        return { message: "Attendance session created", date, subject_id: subjectId };
    } finally {
        connection.release();
    }
};

export const editAttendanceService = async (
    classId: string,
    subjectId: string,
    records: { student_id: string; status: "present" | "absent" }[],
    markedBy: string,
    date: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        if (!subjectId || typeof subjectId !== "string") {
            throw new BadRequestError("subject_id is required");
        }
        if (!Array.isArray(records) || records.length === 0) {
            throw new BadRequestError("No attendance records provided");
        }
        if (!DATE_ONLY.test(date)) {
            throw new BadRequestError("date must be in YYYY-MM-DD format");
        }
        for (const r of records) {
            if (!r || typeof r.student_id !== "string" || (r.status !== "present" && r.status !== "absent")) {
                throw new BadRequestError("Each record requires student_id and status of 'present' or 'absent'");
            }
        }

        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");

        const classModel = new (await import("../model/classes.js")).default(connection);
        const attendanceModel = new AttendanceModel(connection);

        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const classInfo = await classModel.getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }

        const markedByBuf = UUIDToBuffer(markedBy);

        // Faculty must be assigned to this subject in this class
        const assigned = await attendanceModel.isTeacherAssignedToClassSubject(markedByBuf, classBuf, subjectBuf);
        if (!assigned) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        // Validate date range
        const targetDateObj = new Date(`${date}T00:00:00`);
        const now = new Date();
        if (targetDateObj > now) {
            throw new BadRequestError("Cannot mark attendance for a future date");
        }

        // Verify students are enrolled
        const enrollmentModel = new (await import("../model/enrollments.js")).default(connection);
        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(classInfo.school_id);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set for this school");
        }
        const enrolled = await enrollmentModel.getEnrollmentsByClassIdAndSchoolYear(classBuf, currentSy.id);
        const enrolledIds = new Set(enrolled.map(e => bufferToUUID(e.student_id)));

        const invalid = records.filter(r => !enrolledIds.has(r.student_id));
        if (invalid.length > 0) {
            throw new BadRequestError("Some students are not enrolled in this class for the current school year");
        }

        const recordedAt = new Date();

        for (const r of records) {
            await attendanceModel.upsertAttendance(
                classBuf,
                UUIDToBuffer(r.student_id),
                subjectBuf,
                r.status,
                markedByBuf,
                date,
                recordedAt
            );
        }

        return { saved: records.length };
    } finally {
        connection.release();
    }
};

export const getAttendanceByClassAndDateService = async (
    classId: string,
    markedBy: string,
    date: string,
    subjectId: string | undefined,
    isSchoolAdmin: boolean = false
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        if (!DATE_ONLY.test(date)) {
            throw new BadRequestError("date must be in YYYY-MM-DD format");
        }

        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        const classBuf = UUIDToBuffer(classId);
        const classModel = new (await import("../model/classes.js")).default(connection);
        const classInfo = await classModel.getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }

        const markedByBuf = UUIDToBuffer(markedBy);

        // School admins can view attendance for any subject
        // Faculty can only view attendance for subjects they teach
        if (!isSchoolAdmin) {
            if (subjectId) {
                const subjectBuf = UUIDToBuffer(subjectId);
                const assigned = await attendanceModel.isTeacherAssignedToClassSubject(markedByBuf, classBuf, subjectBuf);
                if (!assigned) {
                    throw new ForbiddenError("You are not assigned to teach this subject in this class");
                }
            } else {
                // If no subject specified, check general class assignment
                const assigned = await attendanceModel.isTeacherAssignedToClass(markedByBuf, classBuf);
                if (!assigned) {
                    throw new ForbiddenError("You are not assigned to this class");
                }
            }
        }

        const subjectBuf = subjectId ? UUIDToBuffer(subjectId) : undefined;

        const rows = await attendanceModel.getAttendanceByClassAndDate(classBuf, date, subjectBuf);
        return rows.map(r => ({
            student_id: bufferToUUID(r.student_id),
            subject_id: bufferToUUID(r.subject_id),
            status: r.status,
            recorded_at: r.recorded_at,
            marked_by: bufferToUUID(r.marked_by),
        }));
    } finally {
        connection.release();
    }
};

export const getAttendanceBySchoolAndDateService = async (
    schoolId: number,
    markedBy: string,
    date: string,
    subjectId: string | undefined
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        if (!DATE_ONLY.test(date)) {
            throw new BadRequestError("date must be in YYYY-MM-DD format");
        }

        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        // Verify user belongs to this school
        const facultyModel = new (await import("../model/faculties.js")).default(connection);
        const faculty = await facultyModel.getFacultyById(UUIDToBuffer(markedBy));
        if (!faculty || faculty.school_id !== schoolId) {
            throw new ForbiddenError("You do not belong to this school");
        }

        const targetDate = new Date(`${date}T00:00:00`);
        const subjectBuf = subjectId ? UUIDToBuffer(subjectId) : undefined;

        const rows = await attendanceModel.getAttendanceBySchoolAndDate(schoolId, targetDate, subjectBuf);
        return rows.map(r => ({
            class_id: bufferToUUID(r.class_id),
            student_id: bufferToUUID(r.student_id),
            subject_id: bufferToUUID(r.subject_id),
            status: r.status,
            recorded_at: r.recorded_at,
            marked_by: bufferToUUID(r.marked_by),
        }));
    } finally {
        connection.release();
    }
};

export const getAttendanceHistoryService = async (
    userId: string,
    userRole: string,
    schoolId: number,
    filters: {
        classId?: string | undefined;
        subjectId?: string | undefined;
        studentId?: string | undefined;
        teacherId?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    },
    page: number = 1,
    limit: number = 50
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        // Build filter objects with proper authorization
        const modelFilters: {
            classId?: Buffer;
            subjectId?: Buffer;
            studentId?: Buffer;
            teacherId?: Buffer;
            schoolId?: number;
            dateFrom?: string;
            dateTo?: string;
        } = { schoolId };

        if (filters.classId) {
            modelFilters.classId = UUIDToBuffer(filters.classId);
            // Verify access to this class
            const classModel = new (await import("../model/classes.js")).default(connection);
            const classInfo = await classModel.getClassById(modelFilters.classId);
            if (!classInfo || classInfo.school_id !== schoolId) {
                throw new ForbiddenError("Class not found in your school");
            }
        }

        if (filters.subjectId) {
            modelFilters.subjectId = UUIDToBuffer(filters.subjectId);
        }

        if (filters.studentId) {
            modelFilters.studentId = UUIDToBuffer(filters.studentId);
        }

        if (filters.teacherId) {
            modelFilters.teacherId = UUIDToBuffer(filters.teacherId);
        }

        if (filters.dateFrom && DATE_ONLY.test(filters.dateFrom)) {
            modelFilters.dateFrom = filters.dateFrom;
        }
        if (filters.dateTo && DATE_ONLY.test(filters.dateTo)) {
            modelFilters.dateTo = filters.dateTo;
        }

        // Authorization: Faculty can only see their own classes/subjects
        if (userRole === "faculty") {
            modelFilters.teacherId = UUIDToBuffer(userId);
        }
        // School admin can see all in their school (schoolId already set)

        const result = await attendanceModel.getAttendanceHistory(modelFilters, page, limit);
        return {
            data: result.data.map(r => ({
                attendance_date: r.attendance_date,
                class_id: bufferToUUID(r.class_id),
                class_name: r.class_name,
                subject_id: bufferToUUID(r.subject_id),
                subject_name: r.subject_name,
                present_count: r.present_count,
                absent_count: r.absent_count,
                total_count: r.total_count,
            })),
            total: result.total,
            page,
            limit,
            total_pages: Math.ceil(result.total / limit),
        };
    } finally {
        connection.release();
    }
};

export const getFacultyDashboardSummaryService = async (
    facultyId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        const summary = await attendanceModel.getFacultyDashboardSummary(UUIDToBuffer(facultyId), schoolId);
        return summary;
    } finally {
        connection.release();
    }
};

export const getStudentAttendanceBySubjectService = async (
    studentId: string,
    schoolId: number,
    schoolYearId?: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        // Verify student belongs to this school
        const studentModel = new (await import("../model/students.js")).default(connection);
        const student = await studentModel.getStudentById(UUIDToBuffer(studentId));
        if (!student || student.school_id !== schoolId) {
            throw new ForbiddenError("Student not found in your school");
        }

        const result = await attendanceModel.getStudentAttendanceBySubject(UUIDToBuffer(studentId), schoolId, schoolYearId);
        return result.map(r => ({
            subject_id: bufferToUUID(r.subject_id),
            subject_name: r.subject_name,
            class_id: bufferToUUID(r.class_id),
            class_name: r.class_name,
            teacher_name: r.teacher_name,
            total_sessions: r.total_sessions,
            present_count: r.present_count,
            absent_count: r.absent_count,
            attendance_rate: r.attendance_rate,
        }));
    } finally {
        connection.release();
    }
};

export const getStudentAttendanceDetailService = async (
    studentId: string,
    classId: string,
    subjectId: string,
    schoolId: number,
    dateFrom?: string,
    dateTo?: string,
    page: number = 1,
    limit: number = 50
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        // Verify student belongs to this school
        const studentModel = new (await import("../model/students.js")).default(connection);
        const student = await studentModel.getStudentById(UUIDToBuffer(studentId));
        if (!student || student.school_id !== schoolId) {
            throw new ForbiddenError("Student not found in your school");
        }

        // Verify enrollment
        const enrollmentModel = new (await import("../model/enrollments.js")).default(connection);
        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(schoolId);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set for this school");
        }
        const enrolled = await enrollmentModel.getEnrollmentsByClassIdAndSchoolYear(UUIDToBuffer(classId), currentSy.id);
        const isEnrolled = enrolled.some(e => bufferToUUID(e.student_id) === studentId);
        if (!isEnrolled) {
            throw new ForbiddenError("Student not enrolled in this class");
        }

        const modelFilters = {
            studentId: UUIDToBuffer(studentId),
            classId: UUIDToBuffer(classId),
            subjectId: UUIDToBuffer(subjectId),
            dateFrom: dateFrom && DATE_ONLY.test(dateFrom) ? dateFrom : undefined,
            dateTo: dateTo && DATE_ONLY.test(dateTo) ? dateTo : undefined,
        };

        const result = await attendanceModel.getStudentAttendanceDetail(
            modelFilters.studentId,
            modelFilters.classId,
            modelFilters.subjectId,
            modelFilters.dateFrom,
            modelFilters.dateTo,
            page,
            limit
        );
        return {
            data: result.data.map(r => ({
                attendance_date: r.attendance_date,
                status: r.status,
                recorded_at: r.recorded_at,
                marked_by: bufferToUUID(r.marked_by),
                teacher_name: r.teacher_name,
            })),
            total: result.total,
            page,
            limit,
            total_pages: Math.ceil(result.total / limit),
        };
    } finally {
        connection.release();
    }
};

export const getAllStudentAttendanceRecordsService = async (
    studentId: string,
    schoolId: number,
    filters: {
        subjectId?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    },
    page: number = 1,
    limit: number = 50
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        const studentModel = new (await import("../model/students.js")).default(connection);
        const student = await studentModel.getStudentById(UUIDToBuffer(studentId));
        if (!student || student.school_id !== schoolId) {
            throw new ForbiddenError("Student not found in your school");
        }

        const modelFilters: {
            subjectId?: Buffer;
            dateFrom?: string;
            dateTo?: string;
        } = {};

        if (filters.subjectId) modelFilters.subjectId = UUIDToBuffer(filters.subjectId);
        if (filters.dateFrom && DATE_ONLY.test(filters.dateFrom)) modelFilters.dateFrom = filters.dateFrom;
        if (filters.dateTo && DATE_ONLY.test(filters.dateTo)) modelFilters.dateTo = filters.dateTo;

        const result = await attendanceModel.getAllStudentAttendanceRecords(UUIDToBuffer(studentId), schoolId, modelFilters, page, limit);
        return {
            data: result.data.map(r => ({
                subject_id: bufferToUUID(r.subject_id),
                subject_name: r.subject_name,
                class_name: r.class_name,
                teacher_name: r.teacher_name,
                attendance_date: r.attendance_date,
                status: r.status,
            })),
            total: result.total,
            page,
            limit,
            total_pages: Math.ceil(result.total / limit),
        };
    } finally {
        connection.release();
    }
};

export const getSchoolAttendanceReportService = async (
    schoolId: number,
    userId: string,
    filters: {
        classId?: string | undefined;
        subjectId?: string | undefined;
        teacherId?: string | undefined;
        studentId?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    },
    page: number = 1,
    limit: number = 50
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        // Verify user belongs to this school - check users table (for school_admin) or faculties table (for faculty)
        const userModel = new (await import("../model/users.js")).default(connection);
        const user = await userModel.getUserById(UUIDToBuffer(userId));
        if (!user || user.school_id !== schoolId) {
            throw new ForbiddenError("You do not belong to this school");
        }

        const modelFilters: {
            classId?: Buffer;
            subjectId?: Buffer;
            teacherId?: Buffer;
            studentId?: Buffer;
            dateFrom?: string;
            dateTo?: string;
        } = {};

        if (filters.classId) modelFilters.classId = UUIDToBuffer(filters.classId);
        if (filters.subjectId) modelFilters.subjectId = UUIDToBuffer(filters.subjectId);
        if (filters.teacherId) modelFilters.teacherId = UUIDToBuffer(filters.teacherId);
        if (filters.studentId) modelFilters.studentId = UUIDToBuffer(filters.studentId);
        if (filters.dateFrom && DATE_ONLY.test(filters.dateFrom)) modelFilters.dateFrom = filters.dateFrom;
        if (filters.dateTo && DATE_ONLY.test(filters.dateTo)) modelFilters.dateTo = filters.dateTo;

        const result = await attendanceModel.getSchoolAttendanceReport(schoolId, modelFilters, page, limit);
        return {
            data: result.data.map(r => ({
                class_id: bufferToUUID(r.class_id),
                class_name: r.class_name,
                section: r.section,
                grade_level: r.grade_level,
                subject_id: bufferToUUID(r.subject_id),
                subject_name: r.subject_name,
                teacher_id: bufferToUUID(r.teacher_id),
                teacher_name: r.teacher_name,
                student_id: bufferToUUID(r.student_id),
                student_name: r.student_name,
                attendance_date: r.attendance_date,
                status: r.status,
                recorded_at: r.recorded_at,
                marked_by: bufferToUUID(r.marked_by),
                marked_by_name: r.marked_by_name,
            })),
            total: result.total,
            page,
            limit,
            total_pages: Math.ceil(result.total / limit),
        };
    } finally {
        connection.release();
    }
};

export const getSchoolAttendanceMatrixService = async (
    schoolId: number,
    userId: string,
    filters: {
        classId?: string | undefined;
        subjectId?: string | undefined;
        teacherId?: string | undefined;
        gradeLevel?: string | undefined;
    },
    year: number,
    month: number
) => {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new BadRequestError("year must be a valid four-digit year");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new BadRequestError("month must be between 1 and 12");
    }

    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const attendanceModel = new AttendanceModel(connection);

        // Verify user belongs to this school
        const userModel = new (await import("../model/users.js")).default(connection);
        const user = await userModel.getUserById(UUIDToBuffer(userId));
        if (!user || user.school_id !== schoolId) {
            throw new ForbiddenError("You do not belong to this school");
        }

        const monthStr = String(month).padStart(2, "0");
        const dateFrom = `${year}-${monthStr}-01`;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(schoolId);
        const schoolYearId = currentSy?.id ?? 0;

        const modelFilters: {
            classId?: Buffer;
            subjectId?: Buffer;
            teacherId?: Buffer;
            gradeLevel?: string;
        } = {};

        if (filters.classId) modelFilters.classId = UUIDToBuffer(filters.classId);
        if (filters.subjectId) modelFilters.subjectId = UUIDToBuffer(filters.subjectId);
        if (filters.teacherId) modelFilters.teacherId = UUIDToBuffer(filters.teacherId);
        if (filters.gradeLevel) modelFilters.gradeLevel = filters.gradeLevel;

        const rows = await attendanceModel.getSchoolAttendanceMatrix(schoolId, dateFrom, dateTo, schoolYearId, modelFilters);

        return {
            school_year_name: currentSy?.name ?? null,
            date_from: dateFrom,
            date_to: dateTo,
            data: rows.map(r => ({
                class_id: bufferToUUID(r.class_id),
                class_name: r.class_name,
                section: r.section,
                grade_level: r.grade_level,
                subject_id: bufferToUUID(r.subject_id),
                subject_name: r.subject_name,
                teacher_id: r.teacher_id ? bufferToUUID(r.teacher_id) : null,
                teacher_name: r.teacher_name,
                total_enrolled: Number(r.total_enrolled),
                attendance_date: r.attendance_date,
                present_count: Number(r.present_count),
                absent_count: Number(r.absent_count),
                marked_count: Number(r.marked_count),
            })),
        };
    } finally {
        connection.release();
    }
};