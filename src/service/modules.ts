import { databasePool } from "../config/database.js";
import ModuleModel from "../model/modules.js";
import ModuleActivityTemplateModel from "../model/moduleActivityTemplates.js";
import ModuleLessonModel from "../model/moduleLessons.js";
import SubjectModel from "../model/subjects.js";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../helper/error.js";
import type {
    ModuleListFilters,
    ModuleListRow,
    ModuleProp,
    ModuleStatus,
    TeacherModuleUpdatePayload,
} from "../constant/modules.js";
import { MODULE_STATUSES } from "../constant/modules.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { serializeLesson } from "./moduleLessons.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const serializeModule = (m: ModuleProp) => ({
    ...m,
    id: bufferToUUID(m.id),
    admin_id: m.admin_id ? bufferToUUID(m.admin_id) : null,
    owner_faculty_id: m.owner_faculty_id ? bufferToUUID(m.owner_faculty_id) : null,
    subject_id: m.subject_id ? bufferToUUID(m.subject_id) : null,
});

const serializeModuleList = (m: ModuleListRow) => ({
    ...serializeModule(m),
    template_count: Number(m.template_count ?? 0),
    assignment_count: Number(m.assignment_count ?? 0),
    lesson_count: Number(m.lesson_count ?? 0),
});

const serializeTemplate = (t: {
    id: Buffer;
    module_id: Buffer;
    title: string;
    instructions: string | null;
    category: string;
    max_score: number | string;
    sort_order: number;
    created_at?: Date;
    updated_at?: Date | null;
}) => ({
    ...t,
    id: bufferToUUID(t.id),
    module_id: bufferToUUID(t.module_id),
    max_score: Number(t.max_score),
});

const parseUuid = (value: string, field: string): Buffer => {
    if (!UUID_PATTERN.test(value)) {
        throw new BadRequestError(`Invalid ${field}`);
    }
    return UUIDToBuffer(value);
};

const validateStatus = (value: unknown, fallback?: ModuleStatus): ModuleStatus => {
    if (value === undefined || value === null || value === "") {
        if (fallback) { return fallback; }
        throw new BadRequestError("Status is required");
    }
    if (typeof value !== "string" || !MODULE_STATUSES.includes(value as ModuleStatus)) {
        throw new BadRequestError("Invalid module status");
    }
    return value as ModuleStatus;
};

const validateTitle = (value: unknown): string => {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new BadRequestError("Title is required");
    }
    const title = value.trim();
    if (title.length > 255) {
        throw new BadRequestError("Title must be 255 characters or less");
    }
    return title;
};

const validateOptionalText = (
    value: unknown,
    field: string,
    maxLength: number,
    trim = true
): string | null => {
    if (value === undefined || value === null) { return null; }
    if (typeof value !== "string") {
        throw new BadRequestError(`${field} must be text`);
    }
    const result = trim ? value.trim() : value;
    if (result.length > maxLength) {
        throw new BadRequestError(`${field} must be ${maxLength} characters or less`);
    }
    return result.length === 0 ? null : result;
};

const getSubjectForSchool = async (
    connection: Awaited<ReturnType<ReturnType<typeof databasePool>["getConnection"]>>,
    subjectId: string,
    schoolId: number
) => {
    const subjectModel = new SubjectModel(connection);
    const subject = await subjectModel.getSubjectById(parseUuid(subjectId, "subject_id"));
    if (!subject || subject.school_id !== schoolId) {
        throw new BadRequestError("Subject not found for this school");
    }
    if (subject.is_active !== undefined && Number(subject.is_active) !== 1) {
        throw new BadRequestError("Subject is not active");
    }
    return subject;
};

export const getOwnedModule = async (
    connection: Awaited<ReturnType<ReturnType<typeof databasePool>["getConnection"]>>,
    moduleId: string,
    teacherId: string,
    schoolId: number
): Promise<ModuleProp> => {
    const moduleModel = new ModuleModel(connection);
    const module = await moduleModel.getModuleById(parseUuid(moduleId, "module_id"));
    if (!module) {
        throw new NotFoundError("Module not found", 404);
    }
    if (module.school_id !== schoolId || !module.owner_faculty_id
        || bufferToUUID(module.owner_faculty_id) !== teacherId) {
        throw new ForbiddenError("You do not have permission to access this module");
    }
    return module;
};

export const registerModuleService = async (module: ModuleProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        await moduleModel.registerModule(module);
        return module.id;
    } finally {
        connection.release();
    }
};

export const getModulesBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        const modules = await moduleModel.getModulesBySchoolId(school_id);
        return modules.map(serializeModule);
    } finally {
        connection.release();
    }
};

export const getModuleByIdService = async (
    id: string,
    viewer?: { id: string; role: string }
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        const module = await moduleModel.getModuleById(parseUuid(id, "module_id"));
        if (module === null) {
            throw new NotFoundError("Module not found", 404);
        }
        if (viewer?.role === "faculty" && module.owner_faculty_id
            && bufferToUUID(module.owner_faculty_id) !== viewer.id) {
            throw new ForbiddenError("You do not have permission to access this module");
        }
        return serializeModule(module);
    } finally {
        connection.release();
    }
};

export const updateModuleService = async (
    id: string,
    data: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "lesson_content" | "status">> & {
        subject_id?: Buffer | string | null;
    }
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        const moduleId = parseUuid(id, "module_id");
        const existing = await moduleModel.getModuleById(moduleId);
        if (!existing) {
            throw new NotFoundError("Module not found", 404);
        }

        const normalized: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id" | "lesson_content" | "status">> = {};
        if (data.title !== undefined) { normalized.title = data.title; }
        if (data.description !== undefined) { normalized.description = data.description; }
        if (data.subject !== undefined) { normalized.subject = data.subject; }
        if (data.lesson_content !== undefined) { normalized.lesson_content = data.lesson_content; }
        if (data.status !== undefined) { normalized.status = data.status; }

        if (data.subject_id === null) {
            normalized.subject_id = null;
        } else if (typeof data.subject_id === "string") {
            normalized.subject_id = parseUuid(data.subject_id, "subject_id");
        } else if (data.subject_id !== undefined) {
            normalized.subject_id = data.subject_id;
        }

        if (normalized.subject_id !== undefined && normalized.subject_id !== null && existing.subject_id
            && !normalized.subject_id.equals(existing.subject_id)) {
            const count = await moduleModel.getModuleAssignmentCount(moduleId);
            if (count > 0) {
                throw new ConflictError("Cannot change the subject of a module while it is assigned to a class");
            }
        }

        await moduleModel.updateModule(moduleId, normalized);
    } finally {
        connection.release();
    }
};

export const deleteModuleService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        await moduleModel.deleteModule(parseUuid(id, "module_id"));
    } finally {
        connection.release();
    }
};

export const getAllModulesService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        const modules = await moduleModel.getAllModules();
        return modules.map(serializeModule);
    } finally {
        connection.release();
    }
};

export const listTeacherModulesService = async (
    teacherId: string,
    _schoolId: number,
    rawFilters: { q?: string; status?: string; subject_id?: string }
) => {
    const filters: ModuleListFilters = {};
    if (rawFilters.q && rawFilters.q.trim().length > 0) {
        const q = rawFilters.q.trim();
        if (q.length > 100) {
            throw new BadRequestError("Search query must be 100 characters or less");
        }
        filters.q = q;
    }
    if (rawFilters.status) {
        filters.status = validateStatus(rawFilters.status);
    }
    if (rawFilters.subject_id) {
        filters.subject_id = parseUuid(rawFilters.subject_id, "subject_id");
    }

    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const moduleModel = new ModuleModel(connection);
        const modules = await moduleModel.listModulesByOwner(UUIDToBuffer(teacherId), filters);
        return modules.map(serializeModuleList);
    } finally {
        connection.release();
    }
};

export const createTeacherModuleService = async (
    teacherId: string,
    schoolId: number,
    payload: {
        title?: unknown;
        description?: unknown;
        subject_id?: unknown;
        lesson_content?: unknown;
        status?: unknown;
    }
) => {
    if (typeof payload.subject_id !== "string" || payload.subject_id.length === 0) {
        throw new BadRequestError("Subject is required");
    }
    const title = validateTitle(payload.title);
    const description = validateOptionalText(payload.description, "Description", 5000);
    const lessonContent = validateOptionalText(payload.lesson_content, "Lesson content", 100000, false);
    const status = validateStatus(payload.status, "draft");

    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const subject = await getSubjectForSchool(connection, payload.subject_id, schoolId);
        const moduleModel = new ModuleModel(connection);
        const id = generateRandomUUID();

        await moduleModel.registerModule({
            id,
            title,
            description,
            subject: subject.name,
            subject_id: subject.id,
            school_id: schoolId,
            admin_id: null,
            owner_faculty_id: UUIDToBuffer(teacherId),
            status,
            lesson_content: lessonContent,
        });

        return { id: bufferToUUID(id) };
    } finally {
        connection.release();
    }
};

export const getTeacherModuleService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const templateModel = new ModuleActivityTemplateModel(connection);
        const templates = await templateModel.listByModule(module.id);
        const assignments = await new ModuleModel(connection).getModuleAssignments(module.id);
        const lessonModel = new ModuleLessonModel(connection);
        const lessons = await lessonModel.listByModule(module.id);

        return {
            module: serializeModule(module),
            templates: templates.map(serializeTemplate),
            lessons: lessons.map(serializeLesson),
            assignments: assignments.map((a) => ({
                ...a,
                id: bufferToUUID(a.id),
                module_id: bufferToUUID(a.module_id),
                classroom_id: bufferToUUID(a.classroom_id),
            })),
        };
    } finally {
        connection.release();
    }
};

export const updateTeacherModuleService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    payload: TeacherModuleUpdatePayload
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const moduleModel = new ModuleModel(connection);
        const data: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id" | "lesson_content" | "status">> = {};

        if (payload.title !== undefined) {
            data.title = validateTitle(payload.title);
        }
        if (payload.description !== undefined) {
            data.description = validateOptionalText(payload.description, "Description", 5000);
        }
        if (payload.lesson_content !== undefined) {
            data.lesson_content = validateOptionalText(payload.lesson_content, "Lesson content", 100000, false);
        }
        if (payload.status !== undefined) {
            data.status = validateStatus(payload.status);
        }
        if (payload.subject_id !== undefined) {
            if (typeof payload.subject_id !== "string" || payload.subject_id.length === 0) {
                throw new BadRequestError("Subject is required");
            }
            const newSubjectId = parseUuid(payload.subject_id, "subject_id");
            if (!module.subject_id || !newSubjectId.equals(module.subject_id)) {
                const count = await moduleModel.getModuleAssignmentCount(module.id);
                if (count > 0) {
                    throw new ConflictError("Cannot change the subject of a module while it is assigned to a class");
                }
                const subject = await getSubjectForSchool(connection, payload.subject_id, schoolId);
                data.subject_id = subject.id;
                data.subject = subject.name;
            }
        }

        await moduleModel.updateTeacherModule(module.id, UUIDToBuffer(teacherId), data);
        return getTeacherModuleService(teacherId, schoolId, moduleId);
    } finally {
        connection.release();
    }
};
