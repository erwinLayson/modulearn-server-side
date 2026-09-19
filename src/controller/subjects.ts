import type{Request, Response, NextFunction} from "express";

import type{SubjectProp, SubjectPayload} from "../constant/subjects.js";
import type{TokenPayload} from "../helper/jwt.js";

import { registerSubjectService, getSubjectsBySchoolIdService, getSubjectByIdService, updateSubjectService, deleteSubjectService, getAllSubjectsService, assignFacultyToSubjectService, removeFacultyFromSubjectService, getFacultiesBySubjectIdService, getFacultiesBySchoolIdForSubjectService } from "../service/subjects.js";

import {CheckData} from "../helper/checkdata.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";
import {UUIDToBuffer} from "../helper/UUIDToBuffer.js";
import {sendSuccess} from "../helper/sendSuccess.js";

export const registerSubject = async (
    req: Request<{}, {}, {name: string; subject_code?: string; description?: string}> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const {name, subject_code, description} = req.body;

    const subjectData: SubjectProp = {
        id: generateRandomUUID(),
        name,
        subject_code: subject_code ?? null,
        description: description ?? null,
        school_id: req.user!.school_id!,
        admin_id: UUIDToBuffer(req.user!.id),
        created_at: new Date(),
        updated_at: null,
    };

    CheckData({ name, school_id: subjectData.school_id, admin_id: req.user!.id });

    try {
        await registerSubjectService(subjectData);
        sendSuccess(res, "Subject created successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const getSubjectsBySchoolId = async (
    req: Request<{school_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {school_id} = req.params;

    try {
        const result = await getSubjectsBySchoolIdService(Number(school_id));
        sendSuccess(res, "Subjects retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const getAllSubjects = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const subjects = await getAllSubjectsService();
        sendSuccess(res, "Subjects retrieved", subjects);
    } catch(err) {
        next(err);
    }
};

export const getSubjectById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getSubjectByIdService(id);
        sendSuccess(res, "Subject retrieved", result);
    } catch(err) {
        next(err);
    }
};

export const updateSubject = async (
    req: Request<{id: string}, {}, Partial<Pick<SubjectProp, "name" | "subject_code" | "description">>>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const data = req.body;

    try {
        await updateSubjectService(id, data);
        sendSuccess(res, "Subject updated successfully");
    } catch(err) {
        next(err);
    }
};

export const deleteSubject = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteSubjectService(id);
        sendSuccess(res, "Subject deleted successfully");
    } catch(err) {
        next(err);
    }
};

export const assignFacultyToSubject = async (
    req: Request<{id: string}, {}, {faculty_id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const {faculty_id} = req.body;

    CheckData({ faculty_id });

    try {
        await assignFacultyToSubjectService(id, faculty_id);
        sendSuccess(res, "Faculty assigned to subject", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const removeFacultyFromSubject = async (
    req: Request<{id: string; facultyId: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id, facultyId} = req.params;

    try {
        await removeFacultyFromSubjectService(id, facultyId);
        sendSuccess(res, "Faculty removed from subject");
    } catch(err) {
        next(err);
    }
};

export const getFacultiesBySubjectId = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const result = await getFacultiesBySubjectIdService(id);
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
        const result = await getFacultiesBySchoolIdForSubjectService(Number(school_id));
        sendSuccess(res, "Faculties retrieved", result);
    } catch(err) {
        next(err);
    }
};