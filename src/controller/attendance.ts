import type{Request, Response, NextFunction} from "express";

import type{TokenPayload} from "../helper/jwt.js";

import { 
    markAttendanceService, 
    editAttendanceService,
    createAttendanceSessionService,
    getAttendanceByClassAndDateService, 
    getAttendanceBySchoolAndDateService,
    getAttendanceHistoryService,
    getFacultyDashboardSummaryService,
    getStudentAttendanceBySubjectService,
    getStudentAttendanceDetailService,
    getSchoolAttendanceReportService,
    getSchoolAttendanceMatrixService,
    getAllStudentAttendanceRecordsService
} from "../service/attendance.js";
import {sendSuccess} from "../helper/sendSuccess.js";
import {databasePool} from "../config/database.js";
import AttendanceModel from "../model/attendance.js";
import {UUIDToBuffer} from "../helper/UUIDToBuffer.js";
import {bufferToUUID} from "../helper/bufferToUUID.js";
import {ForbiddenError} from "../helper/error.js";

interface AttendanceMarkRequest {
    records: { student_id: string; status: "present" | "absent" }[];
    date?: string;
    subject_id: string;
}

interface AttendanceSessionRequest {
    class_id: string;
    subject_id: string;
    date: string;
}

export const createAttendanceSession = async (
    req: Request<{}, {}, AttendanceSessionRequest> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {class_id, subject_id, date} = req.body;
    const createdBy = req.user!.id;

    try {
        const result = await createAttendanceSessionService(class_id, subject_id, createdBy, date);
        sendSuccess(res, "Attendance session created successfully", result, 201);
    } catch(err) {
        next(err);
    }
};

export const getClassSessions = async (
    req: Request<{classId: string}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {classId} = req.params;
    const markedBy = req.user!.id;
    const isSchoolAdmin = req.user?.role === "school_admin" || req.user?.role === "super_admin";

    try {
        const pool = databasePool();
        const connection = await pool.getConnection();
        try {
            const attendanceModel = new AttendanceModel(connection);

            const classBuf = UUIDToBuffer(classId);
            const markedByBuf = UUIDToBuffer(markedBy);

            if (!isSchoolAdmin) {
                const assigned = await attendanceModel.isTeacherAssignedToClass(markedByBuf, classBuf);
                if (!assigned) {
                    throw new ForbiddenError("You are not assigned to this class");
                }
            }

            const sessions = await attendanceModel.getSessionsByClass(classBuf);
            sendSuccess(res, "Sessions retrieved", {
                data: sessions.map(s => ({
                    attendance_date: s.attendance_date,
                    subject_id: bufferToUUID(s.subject_id),
                    subject_name: s.subject_name,
                })),
            });
        } finally {
            connection.release();
        }
    } catch(err) {
        next(err);
    }
};

export const markAttendance = async (
    req: Request<{classId: string}, {}, AttendanceMarkRequest> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {classId} = req.params;
    const {records, date, subject_id} = req.body;
    const markedBy = req.user!.id;
    const isSchoolAdmin = req.user?.role === "school_admin" || req.user?.role === "super_admin";

    try {
        const result = await markAttendanceService(classId, subject_id, records, markedBy, date);
        sendSuccess(res, "Attendance saved successfully", result, 200);
    } catch(err) {
        next(err);
    }
};

export const editAttendance = async (
    req: Request<{classId: string}, {}, AttendanceMarkRequest & { date: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {classId} = req.params;
    const {records, date, subject_id} = req.body;
    const markedBy = req.user!.id;

    try {
        const result = await editAttendanceService(classId, subject_id, records, markedBy, date);
        sendSuccess(res, "Attendance updated successfully", result, 200);
    } catch(err) {
        next(err);
    }
};

export const getAttendance = async (
    req: Request<{classId: string}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {classId} = req.params;
    const date = typeof req.query.date === "string" ? req.query.date : "";
    const subjectId = typeof req.query.subject_id === "string" ? req.query.subject_id : undefined;
    const markedBy = req.user!.id;
    const isSchoolAdmin = req.user?.role === "school_admin" || req.user?.role === "super_admin";

    try {
        const result = await getAttendanceByClassAndDateService(classId, markedBy, date, subjectId, isSchoolAdmin);
        sendSuccess(res, "Attendance retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getSchoolAttendance = async (
    req: Request<{schoolId: string}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {schoolId} = req.params;
    const date = typeof req.query.date === "string" ? req.query.date : "";
    const subjectId = typeof req.query.subject_id === "string" ? req.query.subject_id : undefined;
    const markedBy = req.user!.id;

    try {
        const result = await getAttendanceBySchoolAndDateService(Number(schoolId), markedBy, date, subjectId);
        sendSuccess(res, "School attendance retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getAttendanceHistory = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const schoolId = req.user!.school_id!;

    const filters = {
        classId: req.query.class_id as string | undefined,
        subjectId: req.query.subject_id as string | undefined,
        studentId: req.query.student_id as string | undefined,
        teacherId: req.query.teacher_id as string | undefined,
        dateFrom: req.query.date_from as string | undefined,
        dateTo: req.query.date_to as string | undefined,
    } as const;

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    try {
        const result = await getAttendanceHistoryService(userId, userRole, schoolId, filters, page, limit);
        sendSuccess(res, "Attendance history retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getFacultyDashboardSummary = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const facultyId = req.user!.id;
    const schoolId = req.user!.school_id!;

    try {
        const result = await getFacultyDashboardSummaryService(facultyId, schoolId);
        sendSuccess(res, "Faculty dashboard summary retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getStudentAttendanceBySubject = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const studentId = req.user!.id;
    const schoolId = req.user!.school_id!;
    const schoolYearId = req.query.school_year_id ? parseInt(req.query.school_year_id as string) : undefined;

    try {
        const result = await getStudentAttendanceBySubjectService(studentId, schoolId, schoolYearId);
        sendSuccess(res, "Student attendance by subject retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getStudentAttendanceDetail = async (
    req: Request<{classId: string; subjectId: string}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const studentId = req.user!.id;
    const schoolId = req.user!.school_id!;
    const {classId, subjectId} = req.params;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    try {
        const result = await getStudentAttendanceDetailService(studentId, classId, subjectId, schoolId, dateFrom, dateTo, page, limit);
        sendSuccess(res, "Student attendance detail retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getSchoolAttendanceReport = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const schoolId = req.user!.school_id!;
    const userId = req.user!.id;

    const filters = {
        classId: req.query.class_id as string | undefined,
        subjectId: req.query.subject_id as string | undefined,
        teacherId: req.query.teacher_id as string | undefined,
        studentId: req.query.student_id as string | undefined,
        dateFrom: req.query.date_from as string | undefined,
        dateTo: req.query.date_to as string | undefined,
    } as const;

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    try {
        const result = await getSchoolAttendanceReportService(schoolId, userId, filters, page, limit);
        sendSuccess(res, "School attendance report retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getSchoolAttendanceMatrix = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const schoolId = req.user!.school_id!;
    const userId = req.user!.id;

    const filters = {
        classId: req.query.class_id as string | undefined,
        subjectId: req.query.subject_id as string | undefined,
        teacherId: req.query.teacher_id as string | undefined,
        gradeLevel: req.query.grade_level as string | undefined,
    } as const;

    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;

    try {
        const result = await getSchoolAttendanceMatrixService(schoolId, userId, filters, year, month);
        sendSuccess(res, "School attendance matrix retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getAllStudentAttendanceRecords = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const studentId = req.user!.id;
    const schoolId = req.user!.school_id!;

    const filters = {
        subjectId: req.query.subject_id as string | undefined,
        dateFrom: req.query.date_from as string | undefined,
        dateTo: req.query.date_to as string | undefined,
    };

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    try {
        const result = await getAllStudentAttendanceRecordsService(studentId, schoolId, filters, page, limit);
        sendSuccess(res, "Student attendance records retrieved", result);
    } catch(err) {
        next(err);
    }
};