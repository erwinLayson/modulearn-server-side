import { databasePool } from "../config/database.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../helper/error.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { computeNormalizedFinalGrade } from "../helper/gradeCalculation.js";
import GradebookModel from "../model/Gradebook.js";
import PeriodFinalizationsModel from "../model/periodFinalizations.js";
import ClassModel from "../model/classes.js";
import AcademicPeriodsModel from "../model/academicPeriods.js";
import SchoolYearModel from "../model/school-years.js";
import type { PoolConnection } from "mysql2/promise";

async function computeLiveFinalGrade(
    connection: PoolConnection,
    studentBuf: Buffer,
    classBuf: Buffer,
    subjectBuf: Buffer,
    periodId?: number
): Promise<number | null> {
    const model = new GradebookModel(connection);

    const items = await model.getGradeItems(classBuf, subjectBuf, undefined, periodId);
    const { scores } = await model.getStudentGradesForSubject(studentBuf, classBuf, subjectBuf, periodId);
    const scoreMap = new Map<string, number>();
    for (const s of scores) {
        scoreMap.set(bufferToUUID(s.grade_item_id), Number(s.score));
    }

    const weights = await model.getGradingWeights(classBuf, subjectBuf);
    const weightMap = new Map<string, number>();
    for (const w of weights) {
        weightMap.set(w.category, Number(w.weight));
    }

    const attendanceRate = await model.getAttendanceRate(studentBuf, classBuf, subjectBuf, periodId);
    const hasAttendance = await model.hasAttendanceRecords(studentBuf, classBuf, subjectBuf, periodId);

    const categories = ["activities", "quizzes", "exams"] as const;
    const categoryAverages = new Map<string, number | null>();
    for (const cat of categories) {
        const catItems = items.filter(i => i.category === cat);
        let sum = 0, max = 0, hasAny = false;
        for (const i of catItems) {
            const score = scoreMap.get(bufferToUUID(i.id));
            if (score !== undefined && score !== null) {
                sum += score;
                hasAny = true;
            }
            max += Number(i.max_score);
        }
        categoryAverages.set(cat, hasAny && max > 0 ? Math.round((sum / max) * 10000) / 100 : null);
    }

    return computeNormalizedFinalGrade(categoryAverages, attendanceRate, hasAttendance, weightMap);
}

export const finalizePeriodGradesService = async (
    classId: string,
    subjectId: string,
    facultyId: string,
    periodId: number | null,
    role: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const facultyBuf = UUIDToBuffer(facultyId);

        const classInfo = await new ClassModel(connection).getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }

        if (role === "faculty") {
            const assigned = await new GradebookModel(connection).isTeacherAssignedToClassSubject(facultyBuf, classBuf, subjectBuf);
            if (!assigned) {
                throw new ForbiddenError("You are not assigned to teach this subject in this class");
            }
        } else if (role !== "school_admin") {
            throw new ForbiddenError("Insufficient permissions");
        }

        if (periodId !== null) {
            const period = await new AcademicPeriodsModel(connection).getById(periodId);
            if (!period) {
                throw new BadRequestError("Academic period not found");
            }
            if (period.school_id !== classInfo.school_id) {
                throw new BadRequestError("Academic period does not belong to this school");
            }
        }

        const schoolYearId = classInfo.school_year_id;
        const schoolYear = await new SchoolYearModel(connection).getById(schoolYearId);
        if (!schoolYear) {
            throw new BadRequestError("School year not found for this class");
        }

        const [enrollRows] = await connection.execute(
            `SELECT student_id FROM enrollments WHERE class_id = ? AND school_year_id = ? AND status IN ('active', 'completed', 'dropped', 'transferred')`,
            [classBuf, schoolYearId]
        );
        const students = enrollRows as { student_id: Buffer }[];
        if (students.length === 0) {
            throw new BadRequestError("No enrolled students found for this class and school year");
        }

        const finalModel = new PeriodFinalizationsModel(connection);
        let finalizedCount = 0;
        for (const row of students) {
            const finalGrade = await computeLiveFinalGrade(connection, row.student_id, classBuf, subjectBuf, periodId ?? undefined);
            await finalModel.upsert({
                school_id: classInfo.school_id,
                school_year_id: schoolYearId,
                period_id: periodId,
                class_id: classBuf,
                subject_id: subjectBuf,
                student_id: row.student_id,
                final_grade: finalGrade,
                finalized_by: facultyBuf,
            });
            finalizedCount += 1;
        }

        return {
            message: periodId === null
                ? "Year-end grades finalized successfully"
                : "Period grades finalized successfully",
            finalized_count: finalizedCount,
        };
    } finally {
        connection.release();
    }
};

export const correctFinalizationService = async (
    finalizationId: number,
    finalGrade: number | null,
    updatedBy: string,
    role: string,
    reason: string
) => {
    if (role !== "school_admin") {
        throw new ForbiddenError("Only school admins can correct finalized grades");
    }
    if (!reason || !reason.trim()) {
        throw new BadRequestError("Correction reason is required");
    }
    if (finalGrade !== null && (typeof finalGrade !== "number" || finalGrade < 0 || finalGrade > 100)) {
        throw new BadRequestError("Final grade must be between 0 and 100");
    }

    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        await new PeriodFinalizationsModel(connection).correctFinalization(
            finalizationId,
            finalGrade,
            UUIDToBuffer(updatedBy),
            reason.trim()
        );
        return { message: "Finalized grade corrected successfully" };
    } finally {
        connection.release();
    }
};
