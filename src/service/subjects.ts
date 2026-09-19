import {databasePool} from "../config/database.js";
import SubjectModel from "../model/subjects.js";
import {NotFoundError} from "../helper/error.js";
import type{SubjectProp, SubjectPayload} from "../constant/subjects.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";

export const registerSubjectService = async (subject: SubjectProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const subjectModel = new SubjectModel(connection);
        await subjectModel.registerSubject(subject);
        return subject.id;
    } catch(err) {
        throw err;
    } finally {
        connection.release();
    }
};

export const getSubjectsBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const subjectModel = new SubjectModel(connection);
        const subjects = await subjectModel.getSubjectsBySchoolId(school_id);
        return subjects.map(s => ({
            ...s,
            id: bufferToUUID(s.id),
            admin_id: bufferToUUID(s.admin_id),
        }));
    } finally {
        connection.release();
    }
};

export const getSubjectByIdService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const subjectModel = new SubjectModel(connection);
        const subject = await subjectModel.getSubjectById(UUIDToBuffer(id));
        if(subject === null) {
            throw new NotFoundError("Subject not found", 404);
        }
        return {
            ...subject,
            id: bufferToUUID(subject.id),
            admin_id: bufferToUUID(subject.admin_id),
        };
    } finally {
        connection.release();
    }
};

export const updateSubjectService = async (id: string, data: Partial<Pick<SubjectProp, "name" | "subject_code" | "description">>) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const subjectModel = new SubjectModel(connection);
        await subjectModel.updateSubject(UUIDToBuffer(id), data);
    } finally {
        connection.release();
    }
};

export const deleteSubjectService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const subjectModel = new SubjectModel(connection);
        await subjectModel.deleteSubject(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};

export const getAllSubjectsService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const subjectModel = new SubjectModel(connection);
        const subjects = await subjectModel.getAllSubjects();
        return subjects.map(s => ({
            ...s,
            id: bufferToUUID(s.id),
            admin_id: bufferToUUID(s.admin_id),
        }));
    } finally {
        connection.release();
    }
};

export const assignFacultyToSubjectService = async (subjectId: string, facultyId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const subjectModel = new SubjectModel(connection);
        await subjectModel.assignFaculty(UUIDToBuffer(subjectId), UUIDToBuffer(facultyId));
    } finally {
        connection.release();
    }
};

export const removeFacultyFromSubjectService = async (subjectId: string, facultyId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const subjectModel = new SubjectModel(connection);
        await subjectModel.removeFaculty(UUIDToBuffer(subjectId), UUIDToBuffer(facultyId));
    } finally {
        connection.release();
    }
};

export const getFacultiesBySubjectIdService = async (subjectId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const subjectModel = new SubjectModel(connection);
        const faculties = await subjectModel.getFacultiesBySubjectId(UUIDToBuffer(subjectId));
        return faculties.map(f => ({
            ...f,
            id: bufferToUUID(f.id),
        }));
    } finally {
        connection.release();
    }
};

export const getFacultiesBySchoolIdForSubjectService = async (schoolId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const subjectModel = new SubjectModel(connection);
        const faculties = await subjectModel.getFacultiesBySchoolId(schoolId);
        return faculties.map(f => ({
            ...f,
            id: bufferToUUID(f.id),
        }));
    } finally {
        connection.release();
    }
};