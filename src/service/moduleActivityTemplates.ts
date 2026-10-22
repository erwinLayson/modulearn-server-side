import { databasePool } from "../config/database.js";
import ModuleModel from "../model/modules.js";
import ModuleActivityTemplateModel from "../model/moduleActivityTemplates.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../helper/error.js";
import type { GradeItemCategory } from "../constant/gradebook.js";
import { GRADE_ITEM_CATEGORIES } from "../constant/gradebook.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseUuid = (value: string, field: string): Buffer => {
    if (!UUID_PATTERN.test(value)) {
        throw new BadRequestError(`Invalid ${field}`);
    }
    return UUIDToBuffer(value);
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

const validateInstructions = (value: unknown): string | null => {
    if (value === undefined || value === null) { return null; }
    if (typeof value !== "string") {
        throw new BadRequestError("Instructions must be text");
    }
    const instructions = value.trim();
    if (instructions.length > 50000) {
        throw new BadRequestError("Instructions must be 50,000 characters or less");
    }
    return instructions.length === 0 ? null : instructions;
};

const validateCategory = (value: unknown): GradeItemCategory => {
    if (value === undefined || value === null || value === "") {
        return "activities";
    }
    if (typeof value !== "string" || !GRADE_ITEM_CATEGORIES.includes(value as GradeItemCategory)) {
        throw new BadRequestError("Invalid activity category");
    }
    return value as GradeItemCategory;
};

const validateMaxScore = (value: unknown): number => {
    const score = Number(value);
    if (!Number.isFinite(score) || score <= 0) {
        throw new BadRequestError("max_score must be greater than 0");
    }
    if (score > 99999999.99) {
        throw new BadRequestError("max_score is too large");
    }
    return Math.round(score * 100) / 100;
};

const validateSortOrder = (value: unknown): number => {
    if (value === undefined || value === null || value === "") { return 0; }
    const order = Number(value);
    if (!Number.isInteger(order)) {
        throw new BadRequestError("sort_order must be an integer");
    }
    return order;
};

const getOwnedModule = async (
    connection: Awaited<ReturnType<ReturnType<typeof databasePool>["getConnection"]>>,
    moduleId: string,
    teacherId: string,
    schoolId: number
) => {
    const module = await new ModuleModel(connection).getModuleById(parseUuid(moduleId, "module_id"));
    if (!module) {
        throw new NotFoundError("Module not found", 404);
    }
    if (module.school_id !== schoolId || !module.owner_faculty_id
        || bufferToUUID(module.owner_faculty_id) !== teacherId) {
        throw new ForbiddenError("You do not have permission to modify this module");
    }
    return module;
};

const serializeTemplate = (template: {
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
    ...template,
    id: bufferToUUID(template.id),
    module_id: bufferToUUID(template.module_id),
    max_score: Number(template.max_score),
});

const getTemplateForOwnedModule = async (
    connection: Awaited<ReturnType<ReturnType<typeof databasePool>["getConnection"]>>,
    templateId: string,
    moduleId: string,
    teacherId: string,
    schoolId: number
) => {
    const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
    const templateModel = new ModuleActivityTemplateModel(connection);
    const template = await templateModel.getByIdForModule(
        parseUuid(templateId, "template_id"),
        module.id
    );
    if (!template) {
        throw new NotFoundError("Activity template not found", 404);
    }
    return { module, templateModel, template };
};

export const createTemplateService = async (
    moduleId: string,
    teacherId: string,
    schoolId: number,
    payload: {
        title?: unknown;
        instructions?: unknown;
        category?: unknown;
        max_score?: unknown;
        sort_order?: unknown;
    }
) => {
    const title = validateTitle(payload.title);
    const instructions = validateInstructions(payload.instructions);
    const category = validateCategory(payload.category);
    const maxScore = validateMaxScore(payload.max_score);
    const sortOrder = validateSortOrder(payload.sort_order);

    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const templateModel = new ModuleActivityTemplateModel(connection);
        const id = generateRandomUUID();
        await templateModel.createTemplate(id, module.id, {
            title,
            instructions,
            category,
            max_score: maxScore,
            sort_order: sortOrder,
        });
        return { id: bufferToUUID(id) };
    } finally {
        connection.release();
    }
};

export const updateTemplateService = async (
    moduleId: string,
    templateId: string,
    teacherId: string,
    schoolId: number,
    payload: {
        title?: unknown;
        instructions?: unknown;
        category?: unknown;
        max_score?: unknown;
        sort_order?: unknown;
    }
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { template, templateModel } = await getTemplateForOwnedModule(
            connection, templateId, moduleId, teacherId, schoolId
        );

        const data: {
            title?: string;
            instructions?: string | null;
            category?: GradeItemCategory;
            max_score?: number;
            sort_order?: number;
        } = {};

        if (payload.title !== undefined) { data.title = validateTitle(payload.title); }
        if (payload.instructions !== undefined) { data.instructions = validateInstructions(payload.instructions); }
        if (payload.category !== undefined) { data.category = validateCategory(payload.category); }
        if (payload.max_score !== undefined) { data.max_score = validateMaxScore(payload.max_score); }
        if (payload.sort_order !== undefined) { data.sort_order = validateSortOrder(payload.sort_order); }

        await templateModel.updateTemplate(template.id, template.module_id, data);
        return { message: "Activity template updated successfully" };
    } finally {
        connection.release();
    }
};

export const deleteTemplateService = async (
    moduleId: string,
    templateId: string,
    teacherId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { template, templateModel } = await getTemplateForOwnedModule(
            connection, templateId, moduleId, teacherId, schoolId
        );
        await templateModel.deleteTemplate(template.id, template.module_id);
        return { message: "Activity template deleted successfully" };
    } finally {
        connection.release();
    }
};

export const listTemplatesForOwnedModuleService = async (
    moduleId: string,
    teacherId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const templates = await new ModuleActivityTemplateModel(connection).listByModule(module.id);
        return templates.map(serializeTemplate);
    } finally {
        connection.release();
    }
};
