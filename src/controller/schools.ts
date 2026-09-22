import type{Request, Response, NextFunction} from "express";
import type { TokenPayload } from "../helper/jwt.js";
import bcrypt from "bcrypt";

import type{SchoolsProp} from "../constant/schools.js"

import { registerNewSchoolService, getAllSchoolsService } from '../service/schools.js' 

// Helpers
import {CheckData} from "../helper/checkdata.js"
import {generateRandomUUID} from "../helper/generateRandomId.js";
import { getEnvName } from "../helper/getEnv.js";
import {sendSuccess} from "../helper/sendSuccess.js";

export const registerNewSchool = async (
    req: Request<{}, {}, SchoolsProp>,
    res: Response,
    next: NextFunction
) => {
    const {
            address, 
            city, 
            contact_number,
            province,
            region, 
            school_admin, 
            school_email,
            school_id,
            school_level, 
            school_logo, 
            school_name,
            academic_system,
            period_count
        } = req.body;

        // Validate academic_system
        const validSystems = ["quarter", "semester"];
        const system = validSystems.includes(academic_system) ? academic_system : "quarter";
        const pCount = typeof period_count === "number" && period_count >= 1 && period_count <= 6 ? period_count : (system === "quarter" ? 4 : 2);

        //  instanciate school admin credentails
        const schoolAdminCredentials = {
            id: generateRandomUUID(),
            email: school_email,
            school_id: school_id,
            password: await bcrypt.hash(getEnvName("ADMIN_DEFAULT_PASSWORD"), 10)
        };

        // check school admin credentials
        CheckData(schoolAdminCredentials);

        const schoolData = {
            id: generateRandomUUID(),
            address, 
            city, 
            contact_number,
            province,
            region, 
            school_admin, 
            school_email,
            school_id,
            school_level: Number(school_level), 
            academic_system: system,
            period_count: pCount,
            academic_config_completed: 1,
            school_logo, 
            school_name,
            admin_id: schoolAdminCredentials.id
        };
        // check school data 
        CheckData(schoolData)
    try {
        await registerNewSchoolService(schoolData, schoolAdminCredentials)
        sendSuccess(res, "Transaction Successful", undefined, 201);
    }catch(err) {
        next(err)
    }
};

export const getAllSchools = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const schools = await getAllSchoolsService();
        sendSuccess(res, "Schools retrieved", schools);
    } catch (err) {
        next(err);
    }
};

export const getPublicSchoolList = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { getPublicSchoolListService } = await import("../service/schools.js");
        const schools = await getPublicSchoolListService();
        sendSuccess(res, "Schools retrieved", schools);
    } catch (err) {
        next(err);
    }
};

// --- Get school config ---
export const getSchoolConfig = async (
    req: Request<{ id: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const { getSchoolConfigService } = await import("../service/schools.js");
        const result = await getSchoolConfigService(id);
        sendSuccess(res, "School config retrieved", result);
    } catch (err) {
        next(err);
    }
};

// --- Update school config ---
export const updateSchoolConfig = async (
    req: Request<{ id: string }, {}, { academic_system?: string; period_count?: number }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const { academic_system, period_count } = req.body;
        const { updateSchoolConfigService } = await import("../service/schools.js");
        const config: { academic_system?: string; period_count?: number } = {};
        if (academic_system !== undefined) config.academic_system = academic_system;
        if (period_count !== undefined) config.period_count = period_count;
        const result = await updateSchoolConfigService(id, config);
        sendSuccess(res, "School config updated", result);
    } catch (err) {
        next(err);
    }
};
