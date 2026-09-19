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
    try {
        const result = await getGradingWeightsService(classId, subjectId);
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
    const facultyId = req.user!.id;
    try {
        const result = await updateGradingWeightsService(classId, subjectId, facultyId, weights);
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
    try {
        const result = await getGradeItemsService(classId, subjectId, category);
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
    const facultyId = req.user!.id;
    try {
        const result = await createGradeItemService(classId, subjectId, facultyId, category, title, max_score, due_date ?? null);
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
    try {
        const result = await getGradesForSubjectService(classId, subjectId, facultyId);
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
    try {
        const result = await getStudentGradesForSubjectService(studentId, classId, subjectId, schoolId);
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
    try {
        const result = await getStudentSummaryService(studentId, schoolId);
        sendSuccess(res, "Student grade summary retrieved", result);
    } catch (err) {
        next(err);
    }
};
