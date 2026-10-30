import { databasePool } from "../config/database.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../helper/error.js";
import { getOwnedModule } from "./modules.js";
import ModuleLessonModel from "../model/moduleLessons.js";
import ClassModuleModel from "../model/classModules.js";
import ClassModuleLessonModel from "../model/classModuleLessons.js";
import ClassModel from "../model/classes.js";
import SchoolYearModel from "../model/school-years.js";
import type {
    LessonClassAssignmentRow,
    StudentLessonRow,
} from "../constant/classModuleLessons.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseUuid = (value: string, field: string): Buffer => {
    if (!UUID_PATTERN.test(value)) {
        throw new BadRequestError(`Invalid ${field}`);
    }
    return UUIDToBuffer(value);
};

const serializeTeacherAssignment = (row: LessonClassAssignmentRow) => ({
    class_module_id: bufferToUUID(row.class_module_id),
    classroom_id: bufferToUUID(row.classroom_id),
    class_name: row.class_name,
    school_year_id: Number(row.school_year_id),
    school_year_name: row.school_year_name,
    school_year_is_current: Number(row.school_year_is_current),
    assigned: Boolean(Number(row.assigned)),
});

const serializeStudentLesson = (row: StudentLessonRow) => {
    const teacherName = [row.teacher_first_name, row.teacher_last_name]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(" ");

    return {
        assignment_id: bufferToUUID(row.assignment_id),
        lesson_id: bufferToUUID(row.lesson_id),
        module_id: bufferToUUID(row.module_id),
        module_title: row.module_title,
        subject_name: row.subject_name,
        teacher_name: teacherName.length > 0 ? teacherName : null,
        class_id: bufferToUUID(row.class_id),
        class_name: row.class_name,
        school_year_id: Number(row.school_year_id),
        school_year_name: row.school_year_name,
        title: row.title,
        lesson_type: row.lesson_type,
        content: row.content,
        file_name: row.file_name,
        file_type: row.file_type,
        file_size: row.file_size !== null ? Number(row.file_size) : null,
        has_file: Boolean(row.file_path),
        sort_order: Number(row.sort_order ?? 0),
        assigned_at: row.assigned_at instanceof Date
            ? row.assigned_at.toISOString()
            : String(row.assigned_at),
    };
};

export const listLessonClassroomsService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    lessonId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonIdBuf = parseUuid(lessonId, "lesson_id");
        const lesson = await new ModuleLessonModel(connection)
            .getByIdForModule(lessonIdBuf, module.id);
        if (!lesson) {
            throw new NotFoundError("Lesson not found", 404);
        }

        const rows = await new ClassModuleLessonModel(connection)
            .listTeacherAssignments(module.id, lessonIdBuf);
        return rows.map(serializeTeacherAssignment);
    } finally {
        connection.release();
    }
};

export const assignLessonToClassService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    lessonId: string,
    classModuleId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonIdBuf = parseUuid(lessonId, "lesson_id");
        const lesson = await new ModuleLessonModel(connection)
            .getByIdForModule(lessonIdBuf, module.id);
        if (!lesson) {
            throw new NotFoundError("Lesson not found", 404);
        }

        const classModuleIdBuf = parseUuid(classModuleId, "class_module_id");
        const assignment = await new ClassModuleModel(connection)
            .getAssignmentWithModule(classModuleIdBuf);
        if (!assignment || !assignment.module_id.equals(module.id)) {
            throw new NotFoundError("Class assignment not found for this module", 404);
        }

        const classInfo = await new ClassModel(connection)
            .getClassById(assignment.classroom_id);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }
        if (classInfo.school_id !== schoolId) {
            throw new ForbiddenError("You do not have permission to access this class");
        }
        if (Number(classInfo.school_year_id) !== Number(assignment.school_year_id)) {
            throw new BadRequestError("The class does not belong to this school year");
        }

        await new ClassModuleLessonModel(connection)
            .assign(generateRandomUUID(), classModuleIdBuf, lessonIdBuf);

        return { success: true };
    } finally {
        connection.release();
    }
};

export const unassignLessonFromClassService = async (
    teacherId: string,
    schoolId: number,
    moduleId: string,
    lessonId: string,
    classModuleId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const module = await getOwnedModule(connection, moduleId, teacherId, schoolId);
        const lessonIdBuf = parseUuid(lessonId, "lesson_id");
        const lesson = await new ModuleLessonModel(connection)
            .getByIdForModule(lessonIdBuf, module.id);
        if (!lesson) {
            throw new NotFoundError("Lesson not found", 404);
        }

        const classModuleIdBuf = parseUuid(classModuleId, "class_module_id");
        const assignment = await new ClassModuleModel(connection)
            .getAssignmentWithModule(classModuleIdBuf);
        if (!assignment || !assignment.module_id.equals(module.id)) {
            throw new NotFoundError("Class assignment not found for this module", 404);
        }

        await new ClassModuleLessonModel(connection)
            .unassign(classModuleIdBuf, lessonIdBuf);

        return { success: true };
    } finally {
        connection.release();
    }
};

export const listStudentLessonsService = async (
    studentId: string,
    schoolId: number,
    schoolYearId?: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        let targetYear = schoolYearId ?? null;
        if (targetYear === null) {
            const current = await new SchoolYearModel(connection)
                .getCurrentBySchoolId(schoolId);
            targetYear = current ? Number(current.id) : null;
        }

        const rows = await new ClassModuleLessonModel(connection)
            .listForStudent(UUIDToBuffer(studentId), targetYear);
        return rows.map(serializeStudentLesson);
    } finally {
        connection.release();
    }
};

export const getStudentLessonFileService = async (
    studentId: string,
    lessonId: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const lessonIdBuf = parseUuid(lessonId, "lesson_id");
        const file = await new ClassModuleLessonModel(connection)
            .getStudentLessonFile(UUIDToBuffer(studentId), lessonIdBuf);
        if (!file) {
            throw new NotFoundError("Learning material not found", 404);
        }

        return {
            fileName: file.file_name || "learning-material",
            filePath: file.file_path,
            fileType: file.file_type || "application/octet-stream",
        };
    } finally {
        connection.release();
    }
};
