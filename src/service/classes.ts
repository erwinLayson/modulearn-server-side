import {databasePool} from "../config/database.js";
import ClassModel from "../model/classes.js";
import {NotFoundError} from "../helper/error.js";
import type{ClassProp, ClassWithDetails} from "../constant/classes.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";

export const registerClassService = async (cls: ClassProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const classModel = new ClassModel(connection);
        await classModel.registerClass(cls);
        return cls.id;
    } catch(err) {
        throw err;
    } finally {
        connection.release();
    }
};

export const getClassesBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const classModel = new ClassModel(connection);
        const classes = await classModel.getClassesBySchoolId(school_id);
        return classes.map(c => ({
            ...c,
            id: bufferToUUID(c.id),
            faculty_id: bufferToUUID(c.faculty_id),
        }));
    } finally {
        connection.release();
    }
};

export const getClassesBySchoolIdWithDetailsService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const classModel = new ClassModel(connection);
        const classes = await classModel.getClassesBySchoolIdWithDetails(school_id);
        return classes.map(c => ({
            ...c,
            id: bufferToUUID(c.id),
            faculty_id: bufferToUUID(c.faculty_id),
            schedule: c.schedule ? (typeof c.schedule === 'string' ? JSON.parse(c.schedule) : c.schedule) : null,
        }));
    } finally {
        connection.release();
    }
};

export const getAssignedClassesForFacultyService = async (faculty_id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        const rows = await classModel.getClassesByFacultyIdWithDetails(UUIDToBuffer(faculty_id));

        // Merge duplicate rows (one per taught subject) into one entry per class
        const merged = new Map<string, { id: string; class_name: string; school_id: number; faculty_id: string; capacity: number | null; section: string | null; grade_level: string | null; schedule: any | null; created_at: any; faculty_name: string; adviser_role: boolean; subjects: { id: string; name: string }[] }>();
        for (const row of rows) {
            const classId = bufferToUUID(row.id);
            // Only include subjects that have a valid subject_id (required for attendance)
            const subject = row.subject_name && row.subject_id
                ? { id: bufferToUUID(row.subject_id), name: row.subject_name }
                : null;

            if (!merged.has(classId)) {
                merged.set(classId, {
                    id: classId,
                    class_name: row.class_name,
                    school_id: row.school_id,
                    faculty_id: bufferToUUID(row.faculty_id),
                    capacity: row.capacity,
                    section: row.section,
                    grade_level: row.grade_level,
                    schedule: row.schedule ? (typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule) : null,
                    created_at: row.created_at,
                    faculty_name: row.faculty_name,
                    adviser_role: Number(row.adviser_role) === 1,
                    subjects: [],
                });
            }

            const entry = merged.get(classId)!;
            if (subject && !entry.subjects.some(s => s.name === subject.name)) {
                entry.subjects.push(subject);
            }
        }

        return Array.from(merged.values());
    } finally {
        connection.release();
    }
};

export const getClassesByFacultyIdService = async (faculty_id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        const classes = await classModel.getClassesByFacultyId(UUIDToBuffer(faculty_id));
        return classes.map(c => ({
            ...c,
            id: bufferToUUID(c.id),
            faculty_id: bufferToUUID(c.faculty_id),
        }));
    } finally {
        connection.release();
    }
};

export const getAllClassesService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const classModel = new ClassModel(connection);
        const classes = await classModel.getAllClasses();
        return classes.map(c => ({
            ...c,
            id: bufferToUUID(c.id),
            faculty_id: bufferToUUID(c.faculty_id),
            schedule: c.schedule ? (typeof c.schedule === 'string' ? JSON.parse(c.schedule) : c.schedule) : null,
        }));
    } finally {
        connection.release();
    }
};

export const getClassByIdService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        const cls = await classModel.getClassById(UUIDToBuffer(id));
        if(cls === null) {
            throw new NotFoundError("Class not found", 404);
        }
        return {
            ...cls,
            id: bufferToUUID(cls.id),
            faculty_id: bufferToUUID(cls.faculty_id),
            schedule: cls.schedule ? (typeof cls.schedule === 'string' ? JSON.parse(cls.schedule) : cls.schedule) : null,
        };
    } finally {
        connection.release();
    }
};

export const updateClassService = async (id: string, data: Partial<Pick<ClassProp, "class_name" | "faculty_id" | "capacity" | "section" | "grade_level" | "schedule">>) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        const processedData = {
            ...data,
        };
        await classModel.updateClass(UUIDToBuffer(id), processedData);
    } finally {
        connection.release();
    }
};

export const deleteClassService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        await classModel.deleteClass(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};

export const assignFacultyToClassService = async (classId: string, facultyId: string, subjectId: string | null) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        await classModel.assignFaculty(UUIDToBuffer(classId), UUIDToBuffer(facultyId), subjectId ? UUIDToBuffer(subjectId) : null);
    } finally {
        connection.release();
    }
};

export const removeFacultyFromClassService = async (classId: string, facultyId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        await classModel.removeFaculty(UUIDToBuffer(classId), UUIDToBuffer(facultyId));
    } finally {
        connection.release();
    }
};

export const getFacultiesByClassIdService = async (classId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        const faculties = await classModel.getFacultiesByClassId(UUIDToBuffer(classId));
        return faculties.map(f => ({
            id: bufferToUUID(f.id),
            first_name: f.first_name,
            last_name: f.last_name,
            email: f.email,
            subject_id: f.subject_id ? bufferToUUID(f.subject_id) : null,
            subject_name: f.subject_name,
        }));
    } finally {
        connection.release();
    }
};

export const getFacultiesBySchoolIdForClassService = async (schoolId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const classModel = new ClassModel(connection);
        const faculties = await classModel.getFacultiesBySchoolId(schoolId);
        return faculties.map(f => ({
            ...f,
            id: bufferToUUID(f.id),
        }));
    } finally {
        connection.release();
    }
};

export const getAvailableAdvisersService = async (schoolId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const classModel = new ClassModel(connection);
        const faculties = await classModel.getAvailableAdvisers(schoolId);
        return faculties.map(f => ({
            ...f,
            id: bufferToUUID(f.id),
        }));
    } finally {
        connection.release();
    }
};

export const replaceFacultyInClassService = async (classId: string, oldFacultyId: string, newFacultyId: string, subjectId: string | null) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        await classModel.replaceFaculty(UUIDToBuffer(classId), UUIDToBuffer(oldFacultyId), UUIDToBuffer(newFacultyId), subjectId ? UUIDToBuffer(subjectId) : null);
    } finally {
        connection.release();
    }
};
