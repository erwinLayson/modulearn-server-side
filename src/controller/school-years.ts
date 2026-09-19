import type{Request, Response, NextFunction} from "express";
import type{SchoolYearProp} from "../constant/school-years.js";
import type{TokenPayload} from "../helper/jwt.js";
import { createSchoolYearService, getSchoolYearsBySchoolIdService, getCurrentSchoolYearService, getSchoolYearByIdService, setCurrentSchoolYearService, deleteSchoolYearService, autoGenerateSchoolYearsService } from "../service/school-years.js";
import {CheckData} from "../helper/checkdata.js";
import {sendSuccess} from "../helper/sendSuccess.js";

export const createSchoolYear = async (
    req: Request<{}, {}, { name: string; start_date: string; end_date: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {name, start_date, end_date} = req.body;
    const school_id = req.user!.school_id!;
    CheckData({ name, start_date, end_date, school_id });

    try {
        const sy: SchoolYearProp = { id: 0, name, start_date, end_date, school_id, is_current: 0 };
        await createSchoolYearService(sy);
        sendSuccess(res, "School year created", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const getSchoolYearsBySchoolId = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await getSchoolYearsBySchoolIdService(Number(req.params.school_id));
        sendSuccess(res, "School years retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getCurrentSchoolYear = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await getCurrentSchoolYearService(Number(req.params.school_id));
        sendSuccess(res, "Current school year retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getSchoolYearById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await getSchoolYearByIdService(Number(req.params.id));
        sendSuccess(res, "School year retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const setCurrentSchoolYear = async (
    req: Request<{id: string}, {}, {}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const school_id = req.user!.school_id!;
        await setCurrentSchoolYearService(school_id, Number(req.params.id));
        sendSuccess(res, "Current school year updated");
    } catch(err) {
        next(err);
    }
};

export const deleteSchoolYear = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    try {
        await deleteSchoolYearService(Number(req.params.id));
        sendSuccess(res, "School year deleted");
    } catch(err) {
        next(err);
    }
};

export const autoGenerateSchoolYears = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await autoGenerateSchoolYearsService(Number(req.params.school_id));
        sendSuccess(res, "School years ready", result);
    } catch(err) {
        next(err);
    }
};
