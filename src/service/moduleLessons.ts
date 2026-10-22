import { databasePool } from "../config/database.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { BadRequestError, NotFoundError } from "../helper/error.js";
import ModuleLessonModel from "../model/moduleLessons.js";
import type { LessonType, ModuleLessonRow, SerializedModuleLesson } from "../constant/moduleLessons.js";
import { getOwnedModule } from "./modules.js";
import { removeLessonFile } from "../middleware/lessonUpload.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseUuid = (value: string, field: string): Buffer => {
    if (!UUID_PATTERN.test(value)) {
        throw new BadRequestError(`Invalid ${field}`);
    }
    return UUIDToBuffer(value);
};

export const serializeLesson = (row: ModuleLessonRow): SerializedModuleLesson => ({
    id: bufferToUUID(row.id),
    module_id: bufferToUUID(row.module_id),
    title: row.title,
    lesson_type: row.lesson_type,
    content: row.content,
    file_name: row.file_name,
    file_path: row.file_path,
    file_type: row.file_type,
    file_size: row.file_size !== null ? Number(row.file_size) : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at
        ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at))
        : null,
});

export const listModuleLessonsService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonModel = new ModuleLessonModel(connection);
        const rows = await lessonModel.listByModule(module.id);
        return rows.map(serializeLesson);
    } finally {
        connection.release();
    }
};

export const createModuleLessonService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    payload: {
        title?: unknown;
        lesson_type?: unknown;
        content?: unknown;
        sort_order?: unknown;
    },
    file?: Express.Multer.File
) => {
    if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        throw new BadRequestError("Lesson title is required");
    }
    const title = payload.title.trim();
    if (title.length > 255) {
        throw new BadRequestError("Lesson title must be 255 characters or less");
    }

    const lessonType: LessonType = payload.lesson_type === "file" || Boolean(file) ? "file" : "text";

    let content: string | null = null;
    let fileName: string | null = null;
    let filePath: string | null = null;
    let fileType: string | null = null;
    let fileSize: number | null = null;

    if (lessonType === "file") {
        if (!file) {
            throw new BadRequestError("Please select a file to upload for this lesson");
        }
        fileName = file.originalname;
        // relative path accessible via web
        filePath = `/uploads/lessons/${file.filename}`;
        fileType = file.mimetype;
        fileSize = file.size;
        if (typeof payload.content === "string" && payload.content.trim().length > 0) {
            content = payload.content.trim();
        }
    } else {
        if (typeof payload.content !== "string" || payload.content.trim().length === 0) {
            throw new BadRequestError("Lesson text content is required");
        }
        content = payload.content.trim();
    }

    let sortOrder = 0;
    if (payload.sort_order !== undefined && payload.sort_order !== null && String(payload.sort_order).trim() !== "") {
        const parsed = Number(payload.sort_order);
        if (!Number.isInteger(parsed)) {
            throw new BadRequestError("Sort order must be an integer");
        }
        sortOrder = parsed;
    }

    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonId = generateRandomUUID();
        const lessonModel = new ModuleLessonModel(connection);

        await lessonModel.createLesson({
            id: lessonId,
            module_id: module.id,
            title,
            lesson_type: lessonType,
            content,
            file_name: fileName,
            file_path: filePath,
            file_type: fileType,
            file_size: fileSize,
            sort_order: sortOrder,
        });

        const created = await lessonModel.getByIdForModule(lessonId, module.id);
        if (!created) {
            throw new NotFoundError("Lesson not found after creation", 404);
        }
        return serializeLesson(created);
    } catch (err) {
        if (file && filePath) {
            await removeLessonFile(filePath);
        }
        throw err;
    } finally {
        connection.release();
    }
};

export const updateModuleLessonService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    lessonId: string,
    payload: {
        title?: unknown;
        lesson_type?: unknown;
        content?: unknown;
        sort_order?: unknown;
    },
    file?: Express.Multer.File
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonBuf = parseUuid(lessonId, "lesson_id");
        const lessonModel = new ModuleLessonModel(connection);
        const existing = await lessonModel.getByIdForModule(lessonBuf, module.id);
        if (!existing) {
            throw new NotFoundError("Lesson not found", 404);
        }

        const updateData: {
            title?: string;
            lesson_type?: LessonType;
            content?: string | null;
            file_name?: string | null;
            file_path?: string | null;
            file_type?: string | null;
            file_size?: number | null;
            sort_order?: number;
        } = {};

        if (payload.title !== undefined) {
            if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
                throw new BadRequestError("Lesson title is required");
            }
            if (payload.title.trim().length > 255) {
                throw new BadRequestError("Lesson title must be 255 characters or less");
            }
            updateData.title = payload.title.trim();
        }

        if (payload.sort_order !== undefined) {
            const parsed = Number(payload.sort_order);
            if (!Number.isInteger(parsed)) {
                throw new BadRequestError("Sort order must be an integer");
            }
            updateData.sort_order = parsed;
        }

        if (payload.content !== undefined) {
            updateData.content = typeof payload.content === "string" ? payload.content.trim() : null;
        }

        let oldFilePathToDelete: string | null = null;
        if (file) {
            updateData.lesson_type = "file";
            updateData.file_name = file.originalname;
            updateData.file_path = `/uploads/lessons/${file.filename}`;
            updateData.file_type = file.mimetype;
            updateData.file_size = file.size;
            oldFilePathToDelete = existing.file_path;
        }

        await lessonModel.updateLesson(lessonBuf, module.id, updateData);

        if (oldFilePathToDelete && updateData.file_path !== oldFilePathToDelete) {
            await removeLessonFile(oldFilePathToDelete);
        }

        const updated = await lessonModel.getByIdForModule(lessonBuf, module.id);
        return serializeLesson(updated!);
    } catch (err) {
        if (file) {
            await removeLessonFile(`/uploads/lessons/${file.filename}`);
        }
        throw err;
    } finally {
        connection.release();
    }
};

export const deleteModuleLessonService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    lessonId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonBuf = parseUuid(lessonId, "lesson_id");
        const lessonModel = new ModuleLessonModel(connection);
        const existing = await lessonModel.getByIdForModule(lessonBuf, module.id);
        if (!existing) {
            throw new NotFoundError("Lesson not found", 404);
        }

        await lessonModel.deleteLesson(lessonBuf, module.id);

        if (existing.file_path) {
            await removeLessonFile(existing.file_path);
        }

        return { success: true };
    } finally {
        connection.release();
    }
};

export const getModuleLessonFileService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    lessonId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonBuf = parseUuid(lessonId, "lesson_id");
        const lessonModel = new ModuleLessonModel(connection);
        const lesson = await lessonModel.getByIdForModule(lessonBuf, module.id);
        if (!lesson || !lesson.file_path) {
            throw new NotFoundError("Lesson file not found", 404);
        }

        return {
            fileName: lesson.file_name || "lesson-file",
            filePath: lesson.file_path,
            fileType: lesson.file_type || "application/octet-stream",
        };
    } finally {
        connection.release();
    }
};
