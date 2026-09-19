import type{Request, Response, NextFunction} from "express";

import type{ModuleProp} from "../constant/modules.js";
import type{TokenPayload} from "../helper/jwt.js";

import { registerModuleService, getModulesBySchoolIdService, getModuleByIdService, updateModuleService, deleteModuleService, getAllModulesService } from "../service/modules.js";

import {CheckData} from "../helper/checkdata.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";
import {UUIDToBuffer} from "../helper/UUIDToBuffer.js";
import {sendSuccess} from "../helper/sendSuccess.js";

export const registerModule = async (
    req: Request<{}, {}, {title: string; description: string; subject: string; subject_id?: string}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {title, description, subject, subject_id} = req.body;

    const moduleData = {
        id: generateRandomUUID(),
        title,
        description,
        subject,
        subject_id: subject_id ? UUIDToBuffer(subject_id) : null,
        school_id: req.user!.school_id!,
        admin_id: UUIDToBuffer(req.user!.id),
    };

    CheckData({ title, description, subject, school_id: moduleData.school_id, admin_id: req.user!.id });

    try {
        await registerModuleService(moduleData);
        sendSuccess(res, "Module created successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const getModulesBySchoolId = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {school_id} = req.params;

    try {
        const result = await getModulesBySchoolIdService(Number(school_id));
        sendSuccess(res, "Modules retrieved", result);
    } catch(err) {
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
    } catch(err) {
        next(err);
    }
};

export const getModuleById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getModuleByIdService(id);
        sendSuccess(res, "Module retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const updateModule = async (
    req: Request<{id: string}, {}, Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id">>>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const data = req.body;

    try {
        await updateModuleService(id, data);
        sendSuccess(res, "Module updated successfully");
    } catch(err) {
        next(err);
    }
};

export const deleteModule = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteModuleService(id);
        sendSuccess(res, "Module deleted successfully");
    } catch(err) {
        next(err);
    }
};