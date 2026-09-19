import type{Request, Response, NextFunction} from "express";
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
            school_name
        } = req.body;

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
