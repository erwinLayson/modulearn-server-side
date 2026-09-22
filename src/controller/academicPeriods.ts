import type { Request, Response, NextFunction } from "express";
import type { TokenPayload } from "../helper/jwt.js";
import {
    getPeriodsBySchoolAndYearService,
    getCurrentPeriodService,
    getPeriodByIdService,
    createPeriodService,
    updatePeriodService,
    deletePeriodService,
    setCurrentPeriodService,
    generatePeriodsService,
} from "../service/academicPeriods.js";
import { sendSuccess } from "../helper/sendSuccess.js";

// --- List periods for a school year ---
export const getPeriods = async (
    req: Request<{ schoolId: string; yearId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { schoolId, yearId } = req.params;
    try {
        const result = await getPeriodsBySchoolAndYearService(Number(schoolId), Number(yearId));
        sendSuccess(res, "Academic periods retrieved", result);
    } catch (err) {
        next(err);
    }
};

// --- Get current period ---
export const getCurrentPeriod = async (
    req: Request<{ schoolId: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { schoolId } = req.params;
    try {
        const result = await getCurrentPeriodService(Number(schoolId));
        sendSuccess(res, "Current academic period retrieved", result);
    } catch (err) {
        next(err);
    }
};

// --- Create a period ---
export const createPeriod = async (
    req: Request<{}, {}, {
        school_id: number;
        school_year_id: number;
        name: string;
        period_number: number;
        start_date: string;
        end_date: string;
    }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await createPeriodService(req.body);
        sendSuccess(res, "Academic period created", { id: result }, 201);
    } catch (err) {
        next(err);
    }
};

// --- Update a period ---
export const updatePeriod = async (
    req: Request<{ id: string }, {}, { name?: string; start_date?: string; end_date?: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const schoolId = req.user!.school_id!;
    try {
        const result = await updatePeriodService(Number(id), schoolId, req.body);
        sendSuccess(res, "Academic period updated", result);
    } catch (err) {
        next(err);
    }
};

// --- Delete a period ---
export const deletePeriod = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const schoolId = req.user!.school_id!;
    try {
        await deletePeriodService(Number(id), schoolId);
        sendSuccess(res, "Academic period deleted");
    } catch (err) {
        next(err);
    }
};

// --- Set current period ---
export const setCurrentPeriod = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const schoolId = req.user!.school_id!;
    try {
        await setCurrentPeriodService(Number(id), schoolId);
        sendSuccess(res, "Current period updated");
    } catch (err) {
        next(err);
    }
};

// --- Generate missing periods ---
export const generatePeriods = async (
    req: Request<{}, {}, { school_id?: number; school_year_id: number }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const schoolId = req.user!.school_id!;
    const { school_year_id } = req.body;
    try {
        const result = await generatePeriodsService(schoolId, school_year_id);
        sendSuccess(res, result.message, { generated: result.generated });
    } catch (err) {
        next(err);
    }
};
