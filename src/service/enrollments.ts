import {databasePool} from "../config/database.js";
import EnrollmentModel from "../model/enrollments.js";
import ClassModel from "../model/classes.js";
import type{EnrollmentProp} from "../constant/enrollments.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../helper/UUIDToBuffer.js";
import {BadRequestError, NotFoundError} from "../helper/error.js";

export const enrollStudentService = async (enrollment: EnrollmentProp, subjectIds: string[]) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classModel = new ClassModel(connection);
        const enrollmentModel = new EnrollmentModel(connection);

        // 1. Validate class exists
        const classData = await classModel.getClassById(enrollment.class_id);
        if (!classData) {
            throw new NotFoundError("Class not found", 404);
        }

        // 2. Validate enrollment grade_level matches class grade_level
        if (classData.grade_level !== null && enrollment.grade_level !== null) {
            if (String(enrollment.grade_level) !== classData.grade_level) {
                throw new BadRequestError(`Grade level ${enrollment.grade_level} does not match class grade level (${classData.grade_level})`);
            }
        }

        // 3. Check no active enrollment in this school year
        if (enrollment.school_year_id) {
            const hasActive = await enrollmentModel.hasActiveEnrollmentInSchoolYear(enrollment.class_id, enrollment.school_year_id);
            // We need student_id, not class_id for this check
            const hasActiveForStudent = await enrollmentModel.hasActiveEnrollmentInSchoolYear(enrollment.student_id, enrollment.school_year_id);
            if (hasActiveForStudent) {
                throw new BadRequestError("Student already has an active enrollment for this school year");
            }
        }

        // 4. Check no duplicate enrollment
        if (enrollment.school_year_id) {
            const hasDup = await enrollmentModel.hasDuplicateEnrollment(enrollment.student_id, enrollment.class_id, enrollment.school_year_id);
            if (hasDup) {
                throw new BadRequestError("Student is already enrolled in this class for this school year");
            }
        }

        // 5. Check class capacity
        if (classData.capacity !== null && classData.capacity > 0) {
            const activeCount = await enrollmentModel.getActiveEnrollmentCountByClassId(enrollment.class_id);
            if (activeCount >= classData.capacity) {
                throw new BadRequestError(`Class is at full capacity (${classData.capacity} students)`);
            }
        }

        // 6. Validate subjects belong to this class (via class_faculties)
        if (subjectIds.length > 0) {
            const cfQuery = `SELECT subject_id FROM class_faculties WHERE class_id = ? AND subject_id IS NOT NULL`;
            const [cfRows] = await connection.execute(cfQuery, [enrollment.class_id]);
            const validSubjectIds = new Set((cfRows as any[]).map((r: any) => bufferToUUID(r.subject_id)));
            for (const sid of subjectIds) {
                if (!validSubjectIds.has(sid)) {
                    throw new BadRequestError(`Subject ${sid} is not assigned to this class`);
                }
            }
        }

        // 7. Create enrollment
        await enrollmentModel.enrollStudent(enrollment);

        // 8. Add subjects
        if (subjectIds.length > 0) {
            const subjectBuffers = subjectIds.map(sid => UUIDToBuffer(sid));
            await enrollmentModel.addEnrollmentSubjects(enrollment.id, subjectBuffers);
        }

        return enrollment.id;
    } catch(err) {
        throw err;
    } finally {
        connection.release();
    }
};

export const getEnrollmentsByClassAndSchoolYearService = async (classId: string, schoolYearId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const enrollmentModel = new EnrollmentModel(connection);
        const enrollments = await enrollmentModel.getEnrollmentsByClassIdAndSchoolYear(UUIDToBuffer(classId), schoolYearId);

        const results = [];
        for (const e of enrollments) {
            const subjects = await enrollmentModel.getSubjectsByEnrollmentId(e.id);
            results.push({
                id: bufferToUUID(e.id),
                student_id: bufferToUUID(e.student_id),
                student_name: e.student_name,
                student_email: e.student_email,
                class_id: bufferToUUID(e.class_id),
                class_name: e.class_name,
                section: e.section,
                grade_level: e.grade_level,
                school_year_id: e.school_year_id,
                school_year_name: e.school_year_name,
                status: e.status,
                enrolled_at: e.enrolled_at,
                subjects: subjects.map((s: any) => ({
                    id: bufferToUUID(s.id),
                    name: s.name,
                    teacher_name: s.teacher_name,
                })),
            });
        }
        return results;
    } finally {
        connection.release();
    }
};

export const getEnrollmentsByStudentIdService = async (studentId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const enrollmentModel = new EnrollmentModel(connection);
        const enrollments = await enrollmentModel.getEnrollmentsByStudentId(UUIDToBuffer(studentId));

        const results = [];
        for (const e of enrollments) {
            const subjects = await enrollmentModel.getSubjectsByEnrollmentId(e.id);
            results.push({
                id: bufferToUUID(e.id),
                class_id: bufferToUUID(e.class_id),
                class_name: e.class_name,
                section: e.section,
                grade_level: e.grade_level,
                capacity: e.capacity,
                adviser_name: e.adviser_name,
                school_year_id: e.school_year_id,
                school_year_name: e.school_year_name,
                status: e.status,
                enrolled_at: e.enrolled_at,
                schedule: e.schedule ? (typeof e.schedule === 'string' ? JSON.parse(e.schedule) : e.schedule) : null,
                subjects: subjects.map((s: any) => ({
                    id: bufferToUUID(s.id),
                    name: s.name,
                    teacher_name: s.teacher_name,
                })),
            });
        }
        return results;
    } finally {
        connection.release();
    }
};

export const getEnrollmentsByStudentAndSchoolYearService = async (studentId: string, schoolYearId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const enrollmentModel = new EnrollmentModel(connection);
        const enrollments = await enrollmentModel.getEnrollmentsByStudentAndSchoolYear(UUIDToBuffer(studentId), schoolYearId);

        if (enrollments.length === 0) return null;

        const e = enrollments[0]!;
        const subjects = await enrollmentModel.getSubjectsByEnrollmentId(e.id);
        return {
            id: bufferToUUID(e.id),
            class_id: bufferToUUID(e.class_id),
            class_name: e.class_name,
            section: e.section,
            grade_level: e.grade_level,
            capacity: e.capacity,
            adviser_name: e.adviser_name,
            school_year_id: e.school_year_id,
            school_year_name: e.school_year_name,
            status: e.status,
            enrolled_at: e.enrolled_at,
            schedule: e.schedule ? (typeof e.schedule === 'string' ? JSON.parse(e.schedule) : e.schedule) : null,
            subjects: subjects.map((s: any) => ({
                id: bufferToUUID(s.id),
                name: s.name,
                teacher_name: s.teacher_name,
            })),
        };
    } finally {
        connection.release();
    }
};

export const getClassesByStudentIdService = async (studentId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(`
            SELECT DISTINCT e.class_id, c.class_name
            FROM enrollments e
            INNER JOIN classes c ON c.id = e.class_id
            WHERE e.student_id = ? AND e.status = 'active'
        `, [UUIDToBuffer(studentId)]) as any[];

        const result = await Promise.all(rows.map(async (row: any) => {
            const [subjects] = await connection.query(`
                SELECT es.subject_id AS id, s.name
                FROM enrollment_subjects es
                INNER JOIN subjects s ON s.id = es.subject_id
                WHERE es.enrollment_id = (
                    SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active' LIMIT 1
                )
            `, [UUIDToBuffer(studentId), row.class_id]) as any[];
            return {
                class_id: bufferToUUID(row.class_id),
                class_name: row.class_name,
                subjects: subjects.map((s: any) => ({ id: bufferToUUID(s.id), name: s.name })),
            };
        }));
        return result;
    } finally {
        connection.release();
    }
};

export const updateEnrollmentStatusService = async (id: string, status: "active" | "dropped" | "completed") => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const enrollmentModel = new EnrollmentModel(connection);
        await enrollmentModel.updateEnrollmentStatus(UUIDToBuffer(id), status);
    } finally {
        connection.release();
    }
};

export const deleteEnrollmentService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const enrollmentModel = new EnrollmentModel(connection);
        await enrollmentModel.deleteEnrollment(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};
