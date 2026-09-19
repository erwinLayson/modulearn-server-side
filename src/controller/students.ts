import type{Request, Response, NextFunction} from "express";

import type{StudentProp} from "../constant/students.js";
import type { MulterRequest } from "../middleware/upload.js";
import type { TokenPayload } from "../helper/jwt.js";

import { registerStudentService, getStudentsBySchoolIdService, getStudentByIdService, updateStudentService, deleteStudentService, importStudentsService, previewImportStudentsService } from "../service/students.js";
import {BadRequestError} from "../helper/error.js";

// ====================== Helper ======================
import {CheckData} from "../helper/checkdata.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";
import {sendSuccess} from "../helper/sendSuccess.js";
import { hashPassword } from "../helper/hashPassword.js";
import { getEnvName } from "../helper/getEnv.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";

export const registerStudent = async (
    req: Request<{}, {}, StudentProp> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {
        first_name, middle_name, last_name, extension_name, email,
        lrn, date_of_birth, place_of_birth, sex, nationality,
        contact_number, region, province, city_municipality, barangay, purok_street
    } = req.body;

    const studentData = {
        id: generateRandomUUID(),
        first_name,
        middle_name: middle_name || "",
        last_name,
        extension_name: extension_name || "",
        email,
        password: await hashPassword(getEnvName('USER_DEFAULT_PASSWORD')),
        school_id: req.user!.school_id!,
        lrn: lrn || "",
        date_of_birth: date_of_birth || null,
        place_of_birth: place_of_birth || "",
        sex: sex || "male",
        nationality: nationality || "Filipino",
        contact_number: contact_number || "",
        region: region || "",
        province: province || "",
        city_municipality: city_municipality || "",
        barangay: barangay || "",
        purok_street: purok_street || "",
        admin_id: UUIDToBuffer(req.user!.id),
    };

    // Validate only the required fields — optional fields (middle_name, lrn,
    // date_of_birth, address fields...) legitimately arrive empty.
    const requiredFields = ["first_name", "last_name", "email", "school_id"] as const;
    for (const field of requiredFields) {
        const value = (studentData as Record<string, unknown>)[field];
        if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
            return next(new BadRequestError(`Invalid data: ${field}`));
        }
    }

    try {
        await registerStudentService(studentData);
        sendSuccess(res, "Student registered successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const previewImportStudents = async (
    req: MulterRequest,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError("No file uploaded"));
    }

    const file = req.file;
    const isCsv = file.originalname.toLowerCase().endsWith(".csv");
    const fileType: "csv" | "xlsx" = isCsv ? "csv" : "xlsx";

    try {
        const result = await previewImportStudentsService(
            file.buffer,
            fileType,
            req.user!.school_id ?? 0
        );

        sendSuccess(res, "Import preview generated", result);
    } catch(err) {
        next(err);
    }
};

export const importStudents = async (
    req: MulterRequest,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError("No file uploaded"));
    }

    const file = req.file;
    const isCsv = file.originalname.toLowerCase().endsWith(".csv");
    const fileType: "csv" | "xlsx" = isCsv ? "csv" : "xlsx";

    try {
        const result = await importStudentsService(
            file.buffer,
            fileType,
            UUIDToBuffer(req.user!.id),
            req.user!.school_id ?? 0
        );

        sendSuccess(res, "Import completed", result);
    } catch(err) {
        next(err);
    }
};

export const getStudentsBySchoolId = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {school_id} = req.params;

    try {
        const result = await getStudentsBySchoolIdService(Number(school_id));
        sendSuccess(res, "Students retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getStudentById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getStudentByIdService(id);
        sendSuccess(res, "Student retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const updateStudent = async (
    req: Request<{id: string}, {}, Partial<Pick<StudentProp, "first_name" | "last_name" | "email" | "contact_number">>>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const data = req.body;

    try {
        await updateStudentService(id, data);
        sendSuccess(res, "Student updated successfully");
    } catch(err) {
        next(err);
    }
};

export const deleteStudent = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteStudentService(id);
        sendSuccess(res, "Student deleted successfully");
    } catch(err) {
        next(err);
    }
};
