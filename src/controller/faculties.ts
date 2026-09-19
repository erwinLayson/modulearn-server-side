import type{Request, Response, NextFunction} from "express";
import bcrypt from "bcrypt";

import type{FacultyProp} from "../constant/faculties.js";
import type{TokenPayload} from "../helper/jwt.js";
import {UUIDToBuffer} from "../helper/UUIDToBuffer.js";

import { registerFacultyService, getFacultiesBySchoolIdService, getFacultyByIdService, updateFacultyService, deleteFacultyService } from "../service/faculties.js";

import {CheckData} from "../helper/checkdata.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";
import {sendSuccess} from "../helper/sendSuccess.js";

type AuthRequest = Request<{}, {}, FacultyProp> & { user?: TokenPayload };

export const registerFaculty = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const {first_name, last_name, email, contact_number, faculty_role} = req.body;

    const facultyData = {
        id: generateRandomUUID(),
        first_name,
        last_name,
        email,
        password: await bcrypt.hash(process.env.USER_DEFAULT_PASSWORD!, 10),
        school_id: req.user!.school_id!,
        contact_number,
        admin_id: UUIDToBuffer(req.user!.id),
        faculty_role,
    };

    CheckData(facultyData);

    try {
        await registerFacultyService(facultyData);
        sendSuccess(res, "Faculty registered successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const getFacultiesBySchoolId = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {school_id} = req.params;

    try {
        const result = await getFacultiesBySchoolIdService(Number(school_id));
        sendSuccess(res, "Faculties retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getFacultyById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getFacultyByIdService(id);
        sendSuccess(res, "Faculty retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const updateFaculty = async (
    req: Request<{id: string}, {}, Partial<Pick<FacultyProp, "first_name" | "last_name" | "email" | "contact_number" | "faculty_role">>>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const data = req.body;

    try {
        await updateFacultyService(id, data);
        sendSuccess(res, "Faculty updated successfully");
    } catch(err) {
        next(err);
    }
};

export const deleteFaculty = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteFacultyService(id);
        sendSuccess(res, "Faculty deleted successfully");
    } catch(err) {
        next(err);
    }
};
