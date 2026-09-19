import type{Request, Response, NextFunction} from "express";

import { enrollStudentService, getEnrollmentsByClassAndSchoolYearService, getEnrollmentsByStudentIdService, getEnrollmentsByStudentAndSchoolYearService, getClassesByStudentIdService, updateEnrollmentStatusService, deleteEnrollmentService } from "../service/enrollments.js";

import {CheckData} from "../helper/checkdata.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";
import {sendSuccess} from "../helper/sendSuccess.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";

export const enrollStudent = async (
    req: Request<{}, {}, { student_id: string; class_id: string; school_year_id: number; grade_level: number; subject_ids: string[] }>,
    res: Response,
    next: NextFunction
) => {
    const {student_id, class_id, school_year_id, grade_level, subject_ids} = req.body;

    CheckData({ student_id, class_id, school_year_id, grade_level });

    const enrollmentData = {
        id: generateRandomUUID(),
        student_id: UUIDToBuffer(student_id),
        class_id: UUIDToBuffer(class_id),
        school_year_id: school_year_id,
        grade_level: grade_level,
        status: "active" as const,
    };

    try {
        await enrollStudentService(enrollmentData, subject_ids || []);
        sendSuccess(res, "Student enrolled successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const getEnrollmentsByClassAndSchoolYear = async (
    req: Request<{class_id: string; school_year_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {class_id, school_year_id} = req.params;

    try {
        const result = await getEnrollmentsByClassAndSchoolYearService(class_id, Number(school_year_id));
        sendSuccess(res, "Enrollments retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getEnrollmentsByStudentId = async (
    req: Request<{student_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {student_id} = req.params;

    try {
        const result = await getEnrollmentsByStudentIdService(student_id);
        sendSuccess(res, "Enrollments retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getEnrollmentsByStudentAndSchoolYear = async (
    req: Request<{student_id: string; school_year_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {student_id, school_year_id} = req.params;

    try {
        const result = await getEnrollmentsByStudentAndSchoolYearService(student_id, Number(school_year_id));
        sendSuccess(res, "Enrollment retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getClassesByStudentId = async (
    req: Request<{student_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {student_id} = req.params;

    try {
        const result = await getClassesByStudentIdService(student_id);
        sendSuccess(res, "Classes retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const updateEnrollmentStatus = async (
    req: Request<{id: string}, {}, {status: "active" | "dropped" | "completed"}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const {status} = req.body;

    CheckData({status});

    try {
        await updateEnrollmentStatusService(id, status);
        sendSuccess(res, "Enrollment status updated");
    } catch(err) {
        next(err);
    }
};

export const deleteEnrollment = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteEnrollmentService(id);
        sendSuccess(res, "Enrollment deleted successfully");
    } catch(err) {
        next(err);
    }
};
