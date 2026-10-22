import { databasePool } from "../config/database.js";
import ClassModuleModel from "../model/classModules.js";
import ModuleModel from "../model/modules.js";
import ModuleActivityTemplateModel from "../model/moduleActivityTemplates.js";
import ClassModel from "../model/classes.js";
import SchoolYearModel from "../model/school-years.js";
import GradebookModel from "../model/Gradebook.js";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../helper/error.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { createGradeItemService } from "./gradebook.js";
import type { GradeItemCategory } from "../constant/gradebook.js";
import { GRADE_ITEM_CATEGORIES } from "../constant/gradebook.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseUuid = (value: string, field: string): Buffer => {
    if (!UUID_PATTERN.test(value)) {
        throw new BadRequestError(`Invalid ${field}`);
    }
    return UUIDToBuffer(value);
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
        throw new ForbiddenError("You do not have permission to access this module");
    }
    return module;
};

const serializeTemplate = (template: {
    id: Buffer;
    module_id: Buffer;
    title: string;
    instructions: string | null;
    category: GradeItemCategory;
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

export const assignModuleService = async (
    moduleId: string,
    classroomId: string,
    schoolYearId: number,
    teacherId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        if (module.status === "archived") {
            throw new BadRequestError("Archived modules cannot be assigned to a class");
        }
        if (!module.subject_id) {
            throw new BadRequestError("This module must have a subject before it can be assigned");
        }

        const classModel = new ClassModel(connection);
        const classBuf = parseUuid(classroomId, "classroom_id");
        const classInfo = await classModel.getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }
        if (classInfo.school_id !== schoolId) {
            throw new ForbiddenError("You do not have permission to access this class");
        }
        if (classInfo.is_active !== undefined && Number(classInfo.is_active) !== 1) {
            throw new BadRequestError("This class is no longer active");
        }
        if (Number(classInfo.school_year_id) !== Number(schoolYearId)) {
            throw new BadRequestError("The selected class does not belong to this school year");
        }

        const schoolYear = await new SchoolYearModel(connection).getById(schoolYearId);
        if (!schoolYear || schoolYear.school_id !== schoolId) {
            throw new BadRequestError("School year not found for this school");
        }

        const teacherBuf = UUIDToBuffer(teacherId);
        const assigned = await new GradebookModel(connection)
            .isTeacherAssignedToClassSubject(teacherBuf, classBuf, module.subject_id);
        if (!assigned) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        const classModuleModel = new ClassModuleModel(connection);
        const duplicate = await classModuleModel.findDuplicate(module.id, classBuf, schoolYearId);
        if (duplicate) {
            throw new ConflictError("This module is already assigned to this class for this school year");
        }

        const id = generateRandomUUID();
        await classModuleModel.createAssignment(id, module.id, classBuf, schoolYearId);
        return { id: bufferToUUID(id) };
    } finally {
        connection.release();
    }
};

export const getClassModulesService = async (
    classroomId: string,
    teacherId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const classBuf = parseUuid(classroomId, "classroom_id");
        const classInfo = await new ClassModel(connection).getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }
        if (classInfo.school_id !== schoolId) {
            throw new ForbiddenError("You do not have permission to access this class");
        }

        const teacherBuf = UUIDToBuffer(teacherId);
        const rows = await new ClassModuleModel(connection)
            .listByClassroomForTeacher(classBuf, teacherBuf);
        const templateModel = new ModuleActivityTemplateModel(connection);

        const result = [];
        for (const row of rows) {
            const templates = await templateModel.listByModule(row.module_id);
            result.push({
                id: bufferToUUID(row.id),
                module_id: bufferToUUID(row.module_id),
                classroom_id: bufferToUUID(row.classroom_id),
                class_name: row.class_name,
                school_year_id: row.school_year_id,
                school_year_name: row.school_year_name,
                assigned_at: row.assigned_at,
                title: row.title,
                description: row.description,
                lesson_content: row.lesson_content,
                subject_id: bufferToUUID(row.subject_id),
                subject_name: row.subject_name,
                status: row.status,
                owner_faculty_id: row.owner_faculty_id ? bufferToUUID(row.owner_faculty_id) : null,
                templates: templates.map(serializeTemplate),
            });
        }
        return result;
    } finally {
        connection.release();
    }
};

export const getEligibleClassroomsService = async (
    moduleId: string,
    teacherId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        if (module.status === "archived") {
            throw new BadRequestError("Archived modules cannot be assigned to a class");
        }
        if (!module.subject_id) {
            throw new BadRequestError("This module must have a subject before it can be assigned");
        }

        const rows = await new ClassModuleModel(connection).getEligibleClassrooms(
            module.id,
            module.subject_id,
            UUIDToBuffer(teacherId),
            schoolId
        );

        return rows.map((row) => ({
            classroom_id: bufferToUUID(row.classroom_id),
            class_name: row.class_name,
            section: row.section,
            grade_level: row.grade_level,
            school_year_id: row.school_year_id,
            school_year_name: row.school_year_name,
            already_assigned: Boolean(row.class_module_id),
            class_module_id: row.class_module_id ? bufferToUUID(row.class_module_id) : null,
        }));
    } finally {
        connection.release();
    }
};

export const instantiateTemplateService = async (
    assignmentId: string,
    payload: {
        template_id?: unknown;
        period_id?: unknown;
        due_date?: unknown;
        title?: unknown;
        max_score?: unknown;
    },
    teacherId: string,
    schoolId: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    let templateId: Buffer;
    let templateTitle: string;
    let templateCategory: GradeItemCategory;
    let templateMaxScore: number;
    let templateInstructions: string | null;
    let assignmentIdBuf: Buffer;
    let classroomId: Buffer;
    let subjectId: Buffer;

    try {
        if (typeof payload.template_id !== "string" || payload.template_id.length === 0) {
            throw new BadRequestError("Template is required");
        }

        assignmentIdBuf = parseUuid(assignmentId, "assignment_id");
        const assignment = await new ClassModuleModel(connection).getAssignmentWithModule(assignmentIdBuf);
        if (!assignment) {
            throw new NotFoundError("Module assignment not found", 404);
        }

        classroomId = assignment.classroom_id;
        subjectId = assignment.subject_id;
        if (!subjectId) {
            throw new BadRequestError("This module has no subject");
        }

        const classInfo = await new ClassModel(connection).getClassById(classroomId);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }
        if (classInfo.school_id !== schoolId) {
            throw new ForbiddenError("You do not have permission to access this class");
        }
        if (Number(classInfo.school_year_id) !== Number(assignment.school_year_id)) {
            throw new BadRequestError("The module assignment does not match the class school year");
        }

        const teacherBuf = UUIDToBuffer(teacherId);
        const gradebookModel = new GradebookModel(connection);
        const assigned = await gradebookModel.isTeacherAssignedToClassSubject(
            teacherBuf, classroomId, subjectId
        );
        const isOwner = assignment.owner_faculty_id
            && bufferToUUID(assignment.owner_faculty_id) === teacherId;
        if (!assigned && !isOwner) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        templateId = parseUuid(payload.template_id, "template_id");
        const template = await new ModuleActivityTemplateModel(connection)
            .getByIdForModule(templateId, assignment.module_id);
        if (!template) {
            throw new NotFoundError("Activity template not found", 404);
        }

        templateTitle = template.title;
        templateCategory = template.category;
        templateMaxScore = Number(template.max_score);
        templateInstructions = template.instructions;
    } finally {
        connection.release();
    }

    if (payload.title !== undefined && payload.title !== null && payload.title !== "") {
        if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
            throw new BadRequestError("Title is required");
        }
        templateTitle = payload.title.trim();
        if (templateTitle.length > 255) {
            throw new BadRequestError("Title must be 255 characters or less");
        }
    }

    if (payload.max_score !== undefined && payload.max_score !== null && payload.max_score !== "") {
        const score = Number(payload.max_score);
        if (!Number.isFinite(score) || score <= 0) {
            throw new BadRequestError("max_score must be greater than 0");
        }
        templateMaxScore = Math.round(score * 100) / 100;
    }

    let dueDate: string | null = null;
    if (payload.due_date !== undefined && payload.due_date !== null && payload.due_date !== "") {
        if (typeof payload.due_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)) {
            throw new BadRequestError("due_date must be in YYYY-MM-DD format");
        }
        dueDate = payload.due_date;
    }

    let periodId: number | undefined;
    if (payload.period_id !== undefined && payload.period_id !== null && payload.period_id !== "") {
        periodId = Number(payload.period_id);
    }

    const validCategories: GradeItemCategory[] = [...GRADE_ITEM_CATEGORIES];
    if (!validCategories.includes(templateCategory)) {
        throw new BadRequestError("Invalid activity category");
    }

    const result = await createGradeItemService(
        bufferToUUID(classroomId),
        bufferToUUID(subjectId),
        teacherId,
        templateCategory,
        templateTitle,
        templateMaxScore,
        dueDate,
        periodId,
        {
            instructions: templateInstructions,
            classModuleId: assignmentIdBuf,
            moduleTemplateId: templateId,
        }
    );

    return {
        id: result.id,
        message: "Activity created successfully",
    };
};
