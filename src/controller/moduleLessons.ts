import type { Request, Response, NextFunction } from "express";
import type { TokenPayload } from "../helper/jwt.js";
import { sendSuccess } from "../helper/sendSuccess.js";
import path from "node:path";
import fs from "node:fs";
import {
    createModuleLessonService,
    deleteModuleLessonService,
    getModuleLessonFileService,
    listModuleLessonsService,
    updateModuleLessonService,
} from "../service/moduleLessons.js";
import { NotFoundError } from "../helper/error.js";

export const listModuleLessons = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await listModuleLessonsService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id
        );
        sendSuccess(res, "Module lessons retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const createModuleLesson = async (
    req: Request<{ id: string }, {}, {
        title?: unknown;
        lesson_type?: unknown;
        content?: unknown;
        sort_order?: unknown;
    }> & { user?: TokenPayload; file?: Express.Multer.File },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await createModuleLessonService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            req.body,
            req.file
        );
        sendSuccess(res, "Module lesson created successfully", result, 201);
    } catch (err) {
        next(err);
    }
};

export const updateModuleLesson = async (
    req: Request<{ id: string; lesson_id: string }, {}, {
        title?: unknown;
        lesson_type?: unknown;
        content?: unknown;
        sort_order?: unknown;
    }> & { user?: TokenPayload; file?: Express.Multer.File },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await updateModuleLessonService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            req.params.lesson_id,
            req.body,
            req.file
        );
        sendSuccess(res, "Module lesson updated successfully", result);
    } catch (err) {
        next(err);
    }
};

export const deleteModuleLesson = async (
    req: Request<{ id: string; lesson_id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await deleteModuleLessonService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            req.params.lesson_id
        );
        sendSuccess(res, "Module lesson deleted successfully", result);
    } catch (err) {
        next(err);
    }
};

export const downloadModuleLessonFile = async (
    req: Request<{ id: string; lesson_id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const { fileName, filePath } = await getModuleLessonFileService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
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
