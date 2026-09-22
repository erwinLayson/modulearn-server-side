import type{Request, Response, NextFunction} from "express";

import type{ClassProp} from "../constant/classes.js";
import type{TokenPayload} from "../helper/jwt.js";

import { registerClassService, getClassesBySchoolIdService, getClassesBySchoolIdWithDetailsService, getClassesByFacultyIdService, getAssignedClassesForFacultyService, getAllClassesService, getClassByIdService, updateClassService, deleteClassService, assignFacultyToClassService, removeFacultyFromClassService, getFacultiesByClassIdService, getFacultiesBySchoolIdForClassService, replaceFacultyInClassService, getAvailableAdvisersService } from "../service/classes.js";

import {CheckData} from "../helper/checkdata.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";
import {sendSuccess} from "../helper/sendSuccess.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";

// Request body types (accept string UUIDs from HTTP)
interface ClassCreateRequest {
    class_name: string;
    school_id: number;
    school_year_id: number;
    faculty_id: string;
    capacity?: number | null;
    section?: string | null;
    grade_level?: string | null;
    schedule?: any;
}

interface ClassUpdateRequest {
    class_name?: string | null;
    faculty_id?: string | null;
    school_year_id?: number | null;
    capacity?: number | null;
    section?: string | null;
    grade_level?: string | null;
    schedule?: any;
}

export const registerClass = async (
    req: Request<{}, {}, ClassCreateRequest> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {class_name, faculty_id, school_year_id, capacity, section, grade_level, schedule} = req.body;

    const classData: ClassProp = {
        id: generateRandomUUID(),
        class_name,
        school_id: req.user!.school_id!,
        school_year_id,
        faculty_id: UUIDToBuffer(faculty_id),
        capacity: capacity ?? null,
        section: section ?? null,
        grade_level: grade_level ?? null,
        schedule: schedule ?? null,
    };

    CheckData(classData);

    try {
        await registerClassService(classData);
        sendSuccess(res, "Class created successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const getClassesBySchoolId = async (
    req: Request<{school_id: string}, {}, {}, {school_year_id?: string}>,
    res: Response,
    next: NextFunction
) => {
    const {school_id} = req.params;
    const schoolYearId = req.query.school_year_id ? Number(req.query.school_year_id) : undefined;

    try {
        const result = await getClassesBySchoolIdWithDetailsService(Number(school_id), schoolYearId);
        sendSuccess(res, "Classes retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getAllClasses = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const classes = await getAllClassesService();
        sendSuccess(res, "Classes retrieved", classes);
    } catch(err) {
        next(err);
    }
};

export const getClassesByFacultyId = async (
    req: Request<{faculty_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {faculty_id} = req.params;

    try {
        const result = await getClassesByFacultyIdService(faculty_id);
        sendSuccess(res, "Classes retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getAssignedClassesForFaculty = async (
    req: Request<{faculty_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {faculty_id} = req.params;

    try {
        const result = await getAssignedClassesForFacultyService(faculty_id);
        sendSuccess(res, "Assigned classes retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getClassById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getClassByIdService(id);
        sendSuccess(res, "Class retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const updateClass = async (
    req: Request<{id: string}, {}, ClassUpdateRequest>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const data = req.body;

    // Convert request data to ClassProp partial
    const updateData: Partial<Pick<ClassProp, "class_name" | "faculty_id" | "school_year_id" | "capacity" | "section" | "grade_level" | "schedule">> = {};

    if (data.class_name !== undefined) updateData.class_name = data.class_name as string;
    if (data.capacity !== undefined) updateData.capacity = data.capacity ?? null;
    if (data.section !== undefined) updateData.section = data.section ?? null;
    if (data.grade_level !== undefined) updateData.grade_level = data.grade_level ?? null;
    if (data.schedule !== undefined) updateData.schedule = data.schedule ?? null;
    if (data.school_year_id !== undefined) updateData.school_year_id = data.school_year_id as number;

    // Handle faculty_id separately due to type narrowing
    const toFacultyIdBuffer = (id: string | null | undefined): Buffer => {
        if (!id) return Buffer.alloc(0); // placeholder, won't be used due to check below
        return UUIDToBuffer(id as string);
    };

    const facultyIdBuffer = toFacultyIdBuffer(data.faculty_id);
    if (data.faculty_id) {
        updateData.faculty_id = facultyIdBuffer;
    }

    try {
        await updateClassService(id, updateData);
        sendSuccess(res, "Class updated successfully");
    } catch(err) {
        next(err);
    }
};

export const deleteClass = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteClassService(id);
        sendSuccess(res, "Class deleted successfully");
    } catch(err) {
        next(err);
    }
};

export const assignFacultyToClass = async (
    req: Request<{id: string}, {}, {faculty_id: string; subject_id?: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const {faculty_id, subject_id} = req.body;

    CheckData({ faculty_id });

    try {
        await assignFacultyToClassService(id, faculty_id, subject_id ?? null);
        sendSuccess(res, "Faculty assigned to class", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const removeFacultyFromClass = async (
    req: Request<{id: string; facultyId: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id, facultyId} = req.params;

    try {
        await removeFacultyFromClassService(id, facultyId);
        sendSuccess(res, "Faculty removed from class");
    } catch(err) {
        next(err);
    }
};

export const getFacultiesByClassId = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getFacultiesByClassIdService(id);
        sendSuccess(res, "Faculties retrieved", result);
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
        const result = await getFacultiesBySchoolIdForClassService(Number(school_id));
        sendSuccess(res, "Faculties retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const replaceFacultyInClass = async (
    req: Request<{id: string; facultyId: string}, {}, {new_faculty_id: string; subject_id?: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id, facultyId} = req.params;
    const {new_faculty_id, subject_id} = req.body;

    CheckData({ new_faculty_id });

    try {
        await replaceFacultyInClassService(id, facultyId, new_faculty_id, subject_id ?? null);
        sendSuccess(res, "Faculty replaced in class");
    } catch(err) {
        next(err);
    }
};

export const getAvailableAdvisers = async (
    req: Request<{school_id: string}, {}, {}, {school_year_id?: string}>,
    res: Response,
    next: NextFunction
) => {
    const {school_id} = req.params;
    const schoolYearId = req.query.school_year_id ? Number(req.query.school_year_id) : undefined;

    if (!schoolYearId) {
        return sendSuccess(res, "Available advisers retrieved", []);
    }

    try {
        const result = await getAvailableAdvisersService(Number(school_id), schoolYearId);
        sendSuccess(res, "Available advisers retrieved", result);
    } catch(err) {
        next(err);
    }
};
