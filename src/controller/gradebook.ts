import type { Request, Response, NextFunction } from "express";
import type { TokenPayload } from "../helper/jwt.js";
import {
    getGradingWeightsService,
    updateGradingWeightsService,
    getGradeItemsService,
    createGradeItemService,
    updateGradeItemService,
    deleteGradeItemService,
    getGradesForSubjectService,
    upsertGradesService,
    getStudentGradesForSubjectService,
    getStudentSummaryService,
} from "../service/gradebook.js";
import { sendSuccess } from "../helper/sendSuccess.js";

// --- Grading Weights ---

export const getGradingWeights = async (
    req: Request<{ classId: string; subjectId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { classId, subjectId } = req.params;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    try {
        const result = await getGradingWeightsService(classId, subjectId, periodId);
        sendSuccess(res, "Grading weights retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const updateGradingWeights = async (
    req: Request<{ classId: string; subjectId: string }, {}, { weights: { category: string; weight: number }[] }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { classId, subjectId } = req.params;
    const { weights } = req.body;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    const facultyId = req.user!.id;
    try {
        const result = await updateGradingWeightsService(classId, subjectId, facultyId, weights, periodId);
        sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};

// --- Grade Items ---

export const getGradeItems = async (
    req: Request<{ classId: string; subjectId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { classId, subjectId } = req.params;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    try {
        const result = await getGradeItemsService(classId, subjectId, category, periodId);
        sendSuccess(res, "Grade items retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const createGradeItem = async (
    req: Request<{ classId: string; subjectId: string }, {}, { category: string; title: string; max_score: number; due_date?: string | null }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { classId, subjectId } = req.params;
    const { category, title, max_score, due_date } = req.body;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    const facultyId = req.user!.id;
    try {
        const result = await createGradeItemService(classId, subjectId, facultyId, category, title, max_score, due_date ?? null, periodId);
        sendSuccess(res, result.message, result, 201);
    } catch (err) {
        next(err);
    }
};

export const updateGradeItem = async (
    req: Request<{ id: string }, {}, { title: string; category: string; max_score: number; due_date?: string | null }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const { title, category, max_score, due_date } = req.body;
    const facultyId = req.user!.id;
    try {
        const result = await updateGradeItemService(id, facultyId, title, category, max_score, due_date ?? null);
        sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};

export const deleteGradeItem = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const facultyId = req.user!.id;
    try {
        const result = await deleteGradeItemService(id, facultyId);
        sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};

// --- Grades ---

export const getGradesForSubject = async (
    req: Request<{ classId: string; subjectId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { classId, subjectId } = req.params;
    const facultyId = req.user!.id;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    try {
        const result = await getGradesForSubjectService(classId, subjectId, facultyId, periodId);
        sendSuccess(res, "Grades retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const upsertGrades = async (
    req: Request<{ gradeItemId: string }, {}, { grades: { student_id: string; score: number }[] }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { gradeItemId } = req.params;
    const { grades } = req.body;
    const facultyId = req.user!.id;
    try {
        const result = await upsertGradesService(gradeItemId, grades, facultyId);
        sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};

// --- Student APIs ---

export const getStudentGradesForSubject = async (
    req: Request<{ classId: string; subjectId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { classId, subjectId } = req.params;
    const studentId = req.user!.id;
    const schoolId = req.user!.school_id!;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    try {
        const result = await getStudentGradesForSubjectService(studentId, classId, subjectId, schoolId, periodId);
        sendSuccess(res, "Student grades retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const getStudentSummary = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const studentId = req.user!.id;
    const schoolId = req.user!.school_id!;
    const periodId = typeof req.query.period_id === "string" ? Number(req.query.period_id) : undefined;
    try {
        const result = await getStudentSummaryService(studentId, schoolId, periodId);
        sendSuccess(res, "Student grade summary retrieved", result);
    } catch (err) {
        next(err);
    }
};
