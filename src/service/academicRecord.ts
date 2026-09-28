import { databasePool } from "../config/database.js";
import { ForbiddenError, NotFoundError } from "../helper/error.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import StudentModel from "../model/students.js";
import SchoolsModel from "../model/schools.js";
import EnrollmentModel from "../model/enrollments.js";
import SchoolYearModel from "../model/school-years.js";
import AcademicPeriodsModel from "../model/academicPeriods.js";
import PeriodFinalizationsModel from "../model/periodFinalizations.js";
import GradebookModel from "../model/Gradebook.js";
import { computeNormalizedFinalGrade } from "../helper/gradeCalculation.js";
import type { PoolConnection } from "mysql2/promise";

type Scope = "current" | "all";

async function computeGradeForStudentSubject(
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

export const getStudentAcademicRecordService = async (
    studentId: string,
    schoolId: number,
    scope: Scope
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const studentBuf = UUIDToBuffer(studentId);

        const student = await new StudentModel(connection).getStudentById(studentBuf);
        if (!student) {
            throw new NotFoundError("Student not found", 404);
        }
        if (student.school_id !== schoolId) {
            throw new ForbiddenError("Access denied: cross-school violation");
        }

        const school = await new SchoolsModel(connection).getSchoolBySchoolId(schoolId);
        if (!school) {
            throw new NotFoundError("School not found", 404);
        }

        let schoolYearIds: number[];
        if (scope === "current") {
            const currentSy = await new SchoolYearModel(connection).getCurrentBySchoolId(schoolId);
            if (!currentSy) {
                return {
                    student: {
                        id: bufferToUUID(student.id),
                        first_name: student.first_name,
                        middle_name: student.middle_name,
                        last_name: student.last_name,
                        extension_name: student.extension_name,
                        lrn: student.lrn,
                        email: student.email,
                        sex: student.sex,
                        date_of_birth: student.date_of_birth,
                    },
                    school: {
                        school_id: school.school_id,
                        school_name: school.school_name,
                        address: school.address,
                        region: school.region,
                        province: school.province,
                        city: school.city,
                        contact_number: school.contact_number,
                        school_logo: school.school_logo,
                    },
                    records: [],
                };
            }
            schoolYearIds = [currentSy.id];
        } else {
            const [rows] = await connection.execute(
                `SELECT DISTINCT school_year_id FROM enrollments WHERE student_id = ? ORDER BY school_year_id ASC`,
                [studentBuf]
            );
            schoolYearIds = (rows as { school_year_id: number }[]).map(r => r.school_year_id);
        }

        const enrollmentModel = new EnrollmentModel(connection);
        const schoolYearModel = new SchoolYearModel(connection);
        const periodModel = new AcademicPeriodsModel(connection);
        const finalModel = new PeriodFinalizationsModel(connection);

        const records = [];
        for (const schoolYearId of schoolYearIds) {
            const schoolYear = await schoolYearModel.getById(schoolYearId);
            if (!schoolYear || schoolYear.school_id !== schoolId) continue;

            const enrollmentRows = await enrollmentModel.getEnrollmentsByStudentAndSchoolYear(studentBuf, schoolYearId);
            const e = enrollmentRows[0];
            if (!e) continue;

            const periods = await periodModel.getBySchoolAndYear(schoolId, schoolYearId);
            const subjects = await enrollmentModel.getSubjectsByEnrollmentId(e.id);

            const subjectEntries = [];
            for (const subj of subjects as { id: Buffer; name: string; teacher_name: string | null }[]) {
                const subject_id = bufferToUUID(subj.id);
                const classBuf = e.class_id as Buffer;
                const subjectBuf = subj.id;

                const finalizations = await finalModel.getForStudentClassSubject(studentBuf, classBuf, subjectBuf);
                const yearEnd = finalizations.find(f => f.period_id === null);
                const byPeriod = new Map<number, number | null>();
                for (const f of finalizations) {
                    if (f.period_id !== null) {
                        byPeriod.set(Number(f.period_id), f.final_grade === null ? null : Number(f.final_grade));
                    }
                }

                const grades = [];
                for (const period of periods) {
                    let final_grade: number | null;
                    if (byPeriod.has(period.id)) {
                        final_grade = byPeriod.get(period.id) ?? null;
                    } else {
                        final_grade = await computeGradeForStudentSubject(
                            connection, studentBuf, classBuf, subjectBuf, period.id
                        );
                    }
                    grades.push({
                        period_id: period.id,
                        final_grade: final_grade === null ? null : final_grade,
                    });
                }

                let yearEndGrade: number | null;
                if (yearEnd) {
                    yearEndGrade = yearEnd.final_grade === null ? null : Number(yearEnd.final_grade);
                } else {
                    yearEndGrade = await computeGradeForStudentSubject(
                        connection, studentBuf, classBuf, subjectBuf
                    );
                }

                subjectEntries.push({
                    subject_id,
                    subject_name: subj.name,
                    grades,
                    final_grade: yearEndGrade,
                });
            }

            records.push({
                school_year: {
                    id: schoolYear.id,
                    name: schoolYear.name,
                    start_date: schoolYear.start_date,
                    end_date: schoolYear.end_date,
                    is_current: schoolYear.is_current,
                },
                enrollment: {
                    grade_level: e.grade_level,
                    section: e.section,
                    class_name: e.class_name,
                    adviser_name: e.adviser_name,
                    status: e.status,
                },
                periods: periods.map(p => ({
                    id: p.id,
                    name: p.name,
                    period_number: p.period_number,
                    start_date: p.start_date,
                    end_date: p.end_date,
                })),
                subjects: subjectEntries,
            });
        }

        return {
            student: {
                id: bufferToUUID(student.id),
                first_name: student.first_name,
                middle_name: student.middle_name,
                last_name: student.last_name,
                extension_name: student.extension_name,
                lrn: student.lrn,
                email: student.email,
                sex: student.sex,
                date_of_birth: student.date_of_birth,
            },
            school: {
                school_id: school.school_id,
                school_name: school.school_name,
                address: school.address,
                region: school.region,
                province: school.province,
                city: school.city,
                contact_number: school.contact_number,
                school_logo: school.school_logo,
            },
            records,
        };
    } finally {
        connection.release();
    }
};
