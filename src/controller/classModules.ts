import type { Request, Response, NextFunction } from "express";
import type { TokenPayload } from "../helper/jwt.js";
import { BadRequestError } from "../helper/error.js";
import { sendSuccess } from "../helper/sendSuccess.js";
import {
    assignModuleService,
    getClassModulesService,
    instantiateTemplateService,
} from "../service/classModules.js";

export const assignModule = async (
    req: Request<{}, {}, {
        module_id?: unknown;
        classroom_id?: unknown;
        school_year_id?: unknown;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const { module_id, classroom_id, school_year_id } = req.body;
        if (typeof module_id !== "string" || typeof classroom_id !== "string") {
            throw new BadRequestError("Module and classroom are required");
        }
        const schoolYearId = Number(school_year_id);
        if (!Number.isInteger(schoolYearId) || schoolYearId < 1) {
            throw new BadRequestError("School year is required");
        }

        const result = await assignModuleService(
            module_id,
            classroom_id,
            schoolYearId,
            req.user!.id,
            req.user!.school_id!
        );
        sendSuccess(res, "Module assigned successfully", result, 201);
    } catch (err) {
        next(err);
    }
};

export const getClassModules = async (
    req: Request<{ classId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await getClassModulesService(
            req.params.classId,
            req.user!.id,
            req.user!.school_id!
        );
        sendSuccess(res, "Class modules retrieved", result);
    } catch (err) {
        next(err);
    }
};

export const instantiateTemplate = async (
    req: Request<{ id: string }, {}, {
        template_id?: unknown;
        period_id?: unknown;
        due_date?: unknown;
        title?: unknown;
        max_score?: unknown;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await instantiateTemplateService(
            req.params.id,
            req.body,
            req.user!.id,
            req.user!.school_id!
        );
        sendSuccess(res, result.message, { id: result.id }, 201);
    } catch (err) {
        next(err);
    }
};
