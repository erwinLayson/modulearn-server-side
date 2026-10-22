import type { Request, Response, NextFunction } from "express";

import type { ModuleProp } from "../constant/modules.js";
import type { TokenPayload } from "../helper/jwt.js";

import {
    registerModuleService,
    getModulesBySchoolIdService,
    getModuleByIdService,
    updateModuleService,
    deleteModuleService,
    getAllModulesService,
    listTeacherModulesService,
    createTeacherModuleService,
    getTeacherModuleService,
    updateTeacherModuleService,
} from "../service/modules.js";
import {
    createTemplateService,
    updateTemplateService,
    deleteTemplateService,
} from "../service/moduleActivityTemplates.js";
import { getEligibleClassroomsService } from "../service/classModules.js";

import { CheckData } from "../helper/checkdata.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import { sendSuccess } from "../helper/sendSuccess.js";

export const registerModule = async (
    req: Request<{}, {}, { title: string; description: string; subject: string; subject_id?: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { title, description, subject, subject_id } = req.body;

    const moduleData: ModuleProp = {
        id: generateRandomUUID(),
        title,
        description,
        subject,
        subject_id: subject_id ? UUIDToBuffer(subject_id) : null,
        school_id: req.user!.school_id!,
        admin_id: UUIDToBuffer(req.user!.id),
        owner_faculty_id: null,
        status: "published",
        lesson_content: null,
    };

    CheckData({ title, description, subject, school_id: moduleData.school_id, admin_id: req.user!.id });

    try {
        await registerModuleService(moduleData);
        sendSuccess(res, "Module created successfully", undefined, 201);
    } catch (err) {
        next(err);
    }
};

export const getModulesBySchoolId = async (
    req: Request<{ school_id: string }>,
    res: Response,
    next: NextFunction
) => {
    const { school_id } = req.params;

    try {
        const result = await getModulesBySchoolIdService(Number(school_id));
        sendSuccess(res, "Modules retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const getAllModules = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const modules = await getAllModulesService();
        sendSuccess(res, "Modules retrieved", modules);
    } catch (err) {
        next(err);
    }
};

export const getModuleById = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;

    try {
        const result = await getModuleByIdService(id, req.user);
        sendSuccess(res, "Module retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const updateModule = async (
    req: Request<
        { id: string },
        {},
        {
            title?: string;
            description?: string | null;
            subject?: string;
            subject_id?: string | null;
            lesson_content?: string | null;
        }
    >,
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const body = req.body;

    try {
        const data: Parameters<typeof updateModuleService>[1] = {};
        if (body.title !== undefined) { data.title = body.title; }
        if (body.description !== undefined) { data.description = body.description; }
        if (body.subject !== undefined) { data.subject = body.subject; }
        if (body.subject_id !== undefined) { data.subject_id = body.subject_id; }
        if (body.lesson_content !== undefined) { data.lesson_content = body.lesson_content; }

        await updateModuleService(id, data);
        sendSuccess(res, "Module updated successfully");
    } catch (err) {
        next(err);
    }
};

export const deleteModule = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;

    try {
        await deleteModuleService(id);
        sendSuccess(res, "Module deleted successfully");
    } catch (err) {
        next(err);
    }
};

export const listMyModules = async (
    req: Request & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const filters: { q?: string; status?: string; subject_id?: string } = {};
        if (typeof req.query.q === "string") { filters.q = req.query.q; }
        if (typeof req.query.status === "string") { filters.status = req.query.status; }
        if (typeof req.query.subject_id === "string") { filters.subject_id = req.query.subject_id; }

        const result = await listTeacherModulesService(
            req.user!.id,
            req.user!.school_id!,
            filters
        );
        sendSuccess(res, "Modules retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const createMyModule = async (
    req: Request<{}, {}, {
        title?: unknown;
        description?: unknown;
        subject_id?: unknown;
        lesson_content?: unknown;
        status?: unknown;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await createTeacherModuleService(
            req.user!.id,
            req.user!.school_id!,
            req.body
        );
        sendSuccess(res, "Module created successfully", result, 201);
    } catch (err) {
        next(err);
    }
};

export const getMyModule = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await getTeacherModuleService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id
        );
        sendSuccess(res, "Module retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const updateMyModule = async (
    req: Request<{ id: string }, {}, {
        title?: unknown;
        description?: unknown;
        subject_id?: unknown;
        lesson_content?: unknown;
        status?: unknown;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await updateTeacherModuleService(
            req.user!.id,
            req.user!.school_id!,
            req.params.id,
            {
                ...(req.body.title !== undefined ? { title: req.body.title as string } : {}),
                ...(req.body.description !== undefined ? { description: req.body.description as string | null } : {}),
                ...(req.body.subject_id !== undefined ? { subject_id: req.body.subject_id as string } : {}),
                ...(req.body.lesson_content !== undefined ? { lesson_content: req.body.lesson_content as string | null } : {}),
                ...(req.body.status !== undefined ? { status: req.body.status as ModuleProp["status"] } : {}),
            }
        );
        sendSuccess(res, "Module updated successfully", result);
    } catch (err) {
        next(err);
    }
};

export const getMyEligibleClassrooms = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await getEligibleClassroomsService(
            req.params.id,
            req.user!.id,
            req.user!.school_id!
        );
        sendSuccess(res, "Eligible classrooms retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const createMyModuleTemplate = async (
    req: Request<{ id: string }, {}, {
        title?: unknown;
        instructions?: unknown;
        category?: unknown;
        max_score?: unknown;
        sort_order?: unknown;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await createTemplateService(
            req.params.id,
            req.user!.id,
            req.user!.school_id!,
            req.body
        );
        sendSuccess(res, "Activity template created successfully", result, 201);
    } catch (err) {
        next(err);
    }
};

export const updateMyModuleTemplate = async (
    req: Request<{ id: string; templateId: string }, {}, {
        title?: unknown;
        instructions?: unknown;
        category?: unknown;
        max_score?: unknown;
        sort_order?: unknown;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await updateTemplateService(
            req.params.id,
            req.params.templateId,
            req.user!.id,
            req.user!.school_id!,
            req.body
        );
        sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};

export const deleteMyModuleTemplate = async (
    req: Request<{ id: string; templateId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await deleteTemplateService(
            req.params.id,
            req.params.templateId,
            req.user!.id,
            req.user!.school_id!
        );
        sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};
