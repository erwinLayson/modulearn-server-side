import type { Request, Response, NextFunction } from "express";
import type { TokenPayload } from "../helper/jwt.js";
import { sendSuccess } from "../helper/sendSuccess.js";
import { BadRequestError, NotFoundError } from "../helper/error.js";
import path from "node:path";
import fs from "node:fs";
import {
    assignLessonToClassService,
    getStudentLessonFileService,
    listLessonClassroomsService,
    listStudentLessonsService,
    unassignLessonFromClassService,
} from "../service/classModuleLessons.js";

export const listLessonClassrooms = async (
    req: Request<{ id: string; lesson_id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await listLessonClassroomsService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            req.params.lesson_id
        );
        sendSuccess(res, "Lesson classroom assignments retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const assignLessonToClass = async (
    req: Request<
        { id: string; lesson_id: string },
        {},
        { class_module_id?: unknown }
    > & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        if (typeof req.body.class_module_id !== "string" || req.body.class_module_id.length === 0) {
            throw new BadRequestError("class_module_id is required");
        }

        const result = await assignLessonToClassService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            req.params.lesson_id,
            req.body.class_module_id
        );
        sendSuccess(res, "Lesson assigned to class successfully", result);
    } catch (err) {
        next(err);
    }
};

export const unassignLessonFromClass = async (
    req: Request<{ id: string; lesson_id: string; class_module_id: string }>
        & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await unassignLessonFromClassService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            req.params.lesson_id,
            req.params.class_module_id
        );
        sendSuccess(res, "Lesson removed from class successfully", result);
    } catch (err) {
        next(err);
    }
};

export const listStudentLessons = async (
    req: Request<{}, {}, {}, { school_year_id?: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        let schoolYearId: number | undefined;
        if (req.query.school_year_id !== undefined) {
            const parsed = Number(req.query.school_year_id);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new BadRequestError("Invalid school_year_id");
            }
            schoolYearId = parsed;
        }

        const result = await listStudentLessonsService(
            req.user!.id,
            req.user!.school_id!,
            schoolYearId
        );
        sendSuccess(res, "Learning materials retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const downloadStudentLessonFile = async (
    req: Request<{ lesson_id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const { fileName, filePath } = await getStudentLessonFileService(
            req.user!.id,
            req.params.lesson_id
        );

        const absolutePath = path.resolve(process.cwd(), filePath.replace(/^\/+/, ""));
        if (!fs.existsSync(absolutePath)) {
            throw new NotFoundError("File not found on server", 404);
        }

        res.download(absolutePath, fileName);
    } catch (err) {
        next(err);
    }
};
