import { databasePool } from "../config/database.js";
import GradebookModel from "../model/Gradebook.js";
import type { GradingCategory, GradeItemCategory } from "../constant/gradebook.js";
import { GRADING_CATEGORIES } from "../constant/gradebook.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../helper/error.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { computeNormalizedFinalGrade } from "../helper/gradeCalculation.js";

// --- Grading Weights ---

export const getGradingWeightsService = async (classId: string, subjectId: string, periodId?: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const weights = await model.getGradingWeights(classBuf, subjectBuf, periodId);
        return weights.map(w => ({
            id: w.id,
            category: w.category,
            weight: Number(w.weight),
            period_id: w.period_id,
        }));
    } finally {
        connection.release();
    }
};

export const updateGradingWeightsService = async (
    classId: string,
    subjectId: string,
    facultyId: string,
    weights: { category: string; weight: number }[],
    periodId?: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const facultyBuf = UUIDToBuffer(facultyId);

        // Verify faculty is assigned
        const assigned = await model.isTeacherAssignedToClassSubject(facultyBuf, classBuf, subjectBuf);
        if (!assigned) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        // Validate categories
        if (!Array.isArray(weights) || weights.length !== 4) {
            throw new BadRequestError("Exactly 4 category weights are required");
        }

        const validCategories = new Set(GRADING_CATEGORIES);
        let totalWeight = 0;
        const processedWeights: { category: GradingCategory; weight: number }[] = [];

        for (const w of weights) {
            if (!validCategories.has(w.category as GradingCategory)) {
                throw new BadRequestError(`Invalid category: ${w.category}`);
            }
            if (typeof w.weight !== "number" || w.weight < 0 || w.weight > 100) {
                throw new BadRequestError(`Weight must be between 0 and 100 for category: ${w.category}`);
            }
            totalWeight += w.weight;
            processedWeights.push({ category: w.category as GradingCategory, weight: w.weight });
        }

        if (Math.round(totalWeight * 100) / 100 !== 100) {
            throw new BadRequestError(`Grading weights must total exactly 100%. Current total: ${totalWeight}%`);
        }

        await model.upsertGradingWeights(classBuf, subjectBuf, processedWeights, periodId);
        return { message: "Grading weights updated successfully" };
    } finally {
        connection.release();
    }
};

// --- Grade Items ---

export const getGradeItemsService = async (classId: string, subjectId: string, category?: string, periodId?: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const items = await model.getGradeItems(classBuf, subjectBuf, category as GradeItemCategory | undefined, periodId);
        return items.map(i => ({
            id: bufferToUUID(i.id),
            class_id: bufferToUUID(i.class_id),
            subject_id: bufferToUUID(i.subject_id),
            faculty_id: bufferToUUID(i.faculty_id),
            category: i.category,
            title: i.title,
            max_score: Number(i.max_score),
            due_date: i.due_date,
            period_id: i.period_id,
        }));
    } finally {
        connection.release();
    }
};

export const createGradeItemService = async (
    classId: string,
    subjectId: string,
    facultyId: string,
    category: string,
    title: string,
    maxScore: number,
    dueDate: string | null,
    periodId?: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const facultyBuf = UUIDToBuffer(facultyId);

        // Verify faculty assignment
        const assigned = await model.isTeacherAssignedToClassSubject(facultyBuf, classBuf, subjectBuf);
        if (!assigned) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        // Validate category
        const validItemCategories: GradeItemCategory[] = ["activities", "quizzes", "exams"];
        if (!validItemCategories.includes(category as GradeItemCategory)) {
            throw new BadRequestError(`Invalid category: ${category}. Must be activities, quizzes, or exams`);
        }

        // Validate title
        if (!title || title.trim().length === 0) {
            throw new BadRequestError("Title is required");
        }
        if (title.length > 255) {
            throw new BadRequestError("Title must be 255 characters or less");
        }

        // Validate max score
        if (typeof maxScore !== "number" || maxScore <= 0) {
            throw new BadRequestError("max_score must be greater than 0");
        }

        // Validate due date format if provided
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            throw new BadRequestError("due_date must be in YYYY-MM-DD format");
        }

        const id = await model.createGradeItem(classBuf, subjectBuf, facultyBuf, category as GradeItemCategory, title.trim(), maxScore, dueDate, periodId);
        return { id: bufferToUUID(id), message: "Grade item created successfully" };
    } finally {
        connection.release();
    }
};

export const updateGradeItemService = async (
    itemId: string,
    facultyId: string,
    title: string,
    category: string,
    maxScore: number,
    dueDate: string | null
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const itemBuf = UUIDToBuffer(itemId);
        const facultyBuf = UUIDToBuffer(facultyId);

        // Verify ownership
        const owned = await model.isGradeItemOwnedByFaculty(itemBuf, facultyBuf);
        if (!owned) {
            throw new ForbiddenError("You do not have permission to modify this grade item");
        }

        // Validate category
        const validItemCategories: GradeItemCategory[] = ["activities", "quizzes", "exams"];
        if (!validItemCategories.includes(category as GradeItemCategory)) {
            throw new BadRequestError(`Invalid category: ${category}. Must be activities, quizzes, or exams`);
        }

        if (!title || title.trim().length === 0) {
            throw new BadRequestError("Title is required");
        }
        if (typeof maxScore !== "number" || maxScore <= 0) {
            throw new BadRequestError("max_score must be greater than 0");
        }
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            throw new BadRequestError("due_date must be in YYYY-MM-DD format");
        }

        await model.updateGradeItem(itemBuf, title.trim(), category as GradeItemCategory, maxScore, dueDate);
        return { message: "Grade item updated successfully" };
    } finally {
        connection.release();
    }
};

export const deleteGradeItemService = async (itemId: string, facultyId: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const itemBuf = UUIDToBuffer(itemId);
        const facultyBuf = UUIDToBuffer(facultyId);

        const owned = await model.isGradeItemOwnedByFaculty(itemBuf, facultyBuf);
        if (!owned) {
            throw new ForbiddenError("You do not have permission to delete this grade item");
        }

        await model.deleteGradeItem(itemBuf);
        return { message: "Grade item deleted successfully" };
    } finally {
        connection.release();
    }
};

// --- Grades ---

export const getGradesForSubjectService = async (classId: string, subjectId: string, facultyId: string, periodId?: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);
        const facultyBuf = UUIDToBuffer(facultyId);

        const assigned = await model.isTeacherAssignedToClassSubject(facultyBuf, classBuf, subjectBuf);
        if (!assigned) {
            throw new ForbiddenError("You are not assigned to teach this subject in this class");
        }

        const items = await model.getGradeItems(classBuf, subjectBuf, undefined, periodId);
        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const classModel = new (await import("../model/classes.js")).default(connection);
        const classInfo = await classModel.getClassById(classBuf);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }
        const currentSy = await getCurrentSchoolYearService(classInfo.school_id);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set");
        }

        const students = await model.getEnrolledStudents(classBuf, currentSy.id);
        const weights = await model.getGradingWeights(classBuf, subjectBuf, periodId);

        // Build grade map: grade_item_id -> student_id -> score
        const gradeMap = new Map<string, Map<string, number>>();
        for (const item of items) {
            const grades = await model.getGradesByGradeItem(item.id);
            const studentScores = new Map<string, number>();
            for (const g of grades) {
                studentScores.set(bufferToUUID(g.student_id), Number(g.score));
            }
            gradeMap.set(bufferToUUID(item.id), studentScores);
        }

        // Compute attendance rates and record existence
        const attendanceData = new Map<string, { rate: number; hasRecords: boolean }>();
        for (const s of students) {
            const rate = await model.getAttendanceRate(s.student_id, classBuf, subjectBuf, periodId);
            const hasRecords = await model.hasAttendanceRecords(s.student_id, classBuf, subjectBuf, periodId);
            attendanceData.set(bufferToUUID(s.student_id), { rate, hasRecords });
        }

        // Compute final grades
        const weightMap = new Map<string, number>();
        for (const w of weights) {
            weightMap.set(w.category, Number(w.weight));
        }

        const results = students.map(s => {
            const sid = bufferToUUID(s.student_id);
            let activitiesSum = 0, activitiesMax = 0;
            let quizzesSum = 0, quizzesMax = 0;
            let examsSum = 0, examsMax = 0;

            for (const item of items) {
                const iid = bufferToUUID(item.id);
                const score = gradeMap.get(iid)?.get(sid);
                if (score !== undefined && score !== null) {
                    if (item.category === "activities") {
                        activitiesSum += score;
                        activitiesMax += Number(item.max_score);
                    } else if (item.category === "quizzes") {
                        quizzesSum += score;
                        quizzesMax += Number(item.max_score);
                    } else if (item.category === "exams") {
                        examsSum += score;
                        examsMax += Number(item.max_score);
                    }
                }
            }

            const activitiesPct = activitiesMax > 0 ? (activitiesSum / activitiesMax) * 100 : null;
            const quizzesPct = quizzesMax > 0 ? (quizzesSum / quizzesMax) * 100 : null;
            const examsPct = examsMax > 0 ? (examsSum / examsMax) * 100 : null;
            const attData = attendanceData.get(sid) ?? { rate: 0, hasRecords: false };

            const categoryAverages = new Map<string, number | null>([
                ["activities", activitiesPct],
                ["quizzes", quizzesPct],
                ["exams", examsPct],
            ]);

            const finalGrade = computeNormalizedFinalGrade(
                categoryAverages,
                attData.rate,
                attData.hasRecords,
                weightMap
            );

            return {
                student_id: sid,
                student_name: s.student_name,
                student_email: s.student_email,
                lrn: s.lrn ?? null,
                items: items.map(item => ({
                    id: bufferToUUID(item.id),
                    category: item.category,
                    title: item.title,
                    max_score: Number(item.max_score),
                    score: gradeMap.get(bufferToUUID(item.id))?.get(sid) ?? null,
                })),
                attendance_rate: attData.rate,
                final_grade: finalGrade,
            };
        });

        return {
            class: { id: bufferToUUID(classBuf), name: classInfo.class_name, section: classInfo.section, grade_level: classInfo.grade_level },
            subject: { id: bufferToUUID(subjectBuf) },
            weights: weights.map(w => ({ category: w.category, weight: Number(w.weight) })),
            items: items.map(i => ({
                id: bufferToUUID(i.id),
                category: i.category,
                title: i.title,
                max_score: Number(i.max_score),
                due_date: i.due_date,
            })),
            students: results,
        };
    } finally {
        connection.release();
    }
};

export const upsertGradesService = async (
    gradeItemId: string,
    grades: { student_id: string; score: number }[],
    recordedBy: string
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const itemBuf = UUIDToBuffer(gradeItemId);
        const recordedByBuf = UUIDToBuffer(recordedBy);

        // Get grade item
        const item = await model.getGradeItemById(itemBuf);
        if (!item) {
            throw new NotFoundError("Grade item not found", 404);
        }

        // Verify faculty owns this item
        const owned = await model.isGradeItemOwnedByFaculty(itemBuf, recordedByBuf);
        if (!owned) {
            throw new ForbiddenError("You do not have permission to record grades for this item");
        }

        // Validate and prepare grades
        const processedGrades: { student_id: Buffer; score: number }[] = [];
        const enrolledIds = await model.getEnrolledStudentIds(item.class_id, 0); // Will use proper SY below

        // Get current school year
        const classModel = new (await import("../model/classes.js")).default(connection);
        const classInfo = await classModel.getClassById(item.class_id);
        if (!classInfo) {
            throw new NotFoundError("Class not found", 404);
        }
        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(classInfo.school_id);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set");
        }

        const enrolled = await model.getEnrolledStudentIds(item.class_id, currentSy.id);
        const enrolledSet = new Set(enrolled.map(id => bufferToUUID(id)));

        for (const g of grades) {
            if (typeof g.score !== "number" || g.score < 0) {
                throw new BadRequestError(`Score must be >= 0 for student ${g.student_id}`);
            }
            if (g.score > Number(item.max_score)) {
                throw new BadRequestError(`Score cannot exceed max_score (${item.max_score}) for student ${g.student_id}`);
            }
            if (!enrolledSet.has(g.student_id)) {
                throw new BadRequestError(`Student ${g.student_id} is not enrolled in this class`);
            }
            processedGrades.push({
                student_id: UUIDToBuffer(g.student_id),
                score: g.score,
            });
        }

        await model.upsertGrades(itemBuf, processedGrades, recordedByBuf);
        return { message: "Grades saved successfully" };
    } finally {
        connection.release();
    }
};

// --- Student Grade APIs ---

export const getStudentGradesForSubjectService = async (
    studentId: string,
    classId: string,
    subjectId: string,
    schoolId: number,
    periodId?: number
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const studentBuf = UUIDToBuffer(studentId);
        const classBuf = UUIDToBuffer(classId);
        const subjectBuf = UUIDToBuffer(subjectId);

        // Verify enrollment
        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(schoolId);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set");
        }
        const enrolled = await model.isStudentEnrolledInClass(studentBuf, classBuf, currentSy.id);
        if (!enrolled) {
            throw new ForbiddenError("You are not enrolled in this class");
        }

        const { items, scores } = await model.getStudentGradesForSubject(studentBuf, classBuf, subjectBuf, periodId);
        const scoreMap = new Map<string, number>();
        for (const s of scores) {
            scoreMap.set(bufferToUUID(s.grade_item_id), Number(s.score));
        }

        const weights = await model.getGradingWeights(classBuf, subjectBuf, periodId);
        const weightMap = new Map<string, number>();
        for (const w of weights) {
            weightMap.set(w.category, Number(w.weight));
        }

        const attendanceRate = await model.getAttendanceRate(studentBuf, classBuf, subjectBuf, periodId);
        const hasAttendance = await model.hasAttendanceRecords(studentBuf, classBuf, subjectBuf, periodId);

        // Group items by category and compute averages
        const categories = ["activities", "quizzes", "exams"] as const;
        const categoryData: { activities: { items: { id: string; title: string; score: number | null; max_score: number; due_date: string | null }[]; average: number | null }; quizzes: { items: { id: string; title: string; score: number | null; max_score: number; due_date: string | null }[]; average: number | null }; exams: { items: { id: string; title: string; score: number | null; max_score: number; due_date: string | null }[]; average: number | null } } = {
            activities: { items: [], average: null },
            quizzes: { items: [], average: null },
            exams: { items: [], average: null },
        };

        for (const cat of categories) {
            const catItems = items.filter(i => i.category === cat);
            let sum = 0, max = 0, hasAny = false;
            const itemList = catItems.map(i => {
                const iid = bufferToUUID(i.id);
                const score = scoreMap.get(iid) ?? null;
                if (score !== null) {
                    sum += score;
                    hasAny = true;
                }
                max += Number(i.max_score);
                return { id: iid, title: i.title, score, max_score: Number(i.max_score), due_date: i.due_date };
            });
            categoryData[cat] = {
                items: itemList,
                average: hasAny && max > 0 ? Math.round((sum / max) * 10000) / 100 : null,
            };
        }

        // Compute final grade using normalized weights
        const categoryAverages = new Map<string, number | null>([
            ["activities", categoryData.activities.average],
            ["quizzes", categoryData.quizzes.average],
            ["exams", categoryData.exams.average],
        ]);

        const finalGrade = computeNormalizedFinalGrade(
            categoryAverages,
            attendanceRate,
            hasAttendance,
            weightMap
        );

        const teacherName = await model.getSubjectTeacher(classBuf, subjectBuf);
        const ClassesModel = (await import("../model/classes.js")).default;
        const classModel = new ClassesModel(connection);
        const classInfo = await classModel.getClassById(classBuf);

        // Get subject name
        const subjectQuery = `SELECT name FROM subjects WHERE id = ?`;
        const [subjectRows] = await connection.execute<RowDataPacket[]>(subjectQuery, [subjectBuf]);
        const subjectName = (subjectRows as RowDataPacket[])[0]?.name || "";

        return {
            subject_id: subjectId,
            subject_name: subjectName,
            class_id: classId,
            class_name: classInfo?.class_name || "",
            teacher_name: teacherName || "",
            activities: categoryData.activities,
            quizzes: categoryData.quizzes,
            exams: categoryData.exams,
            attendance_rate: attendanceRate,
            grading_weights: weights.map(w => ({ category: w.category, weight: Number(w.weight) })),
            final_grade: finalGrade,
        };
    } finally {
        connection.release();
    }
};

import type { RowDataPacket } from "mysql2/promise";

export const getStudentSummaryService = async (studentId: string, schoolId: number, periodId?: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const model = new GradebookModel(connection);
        const studentBuf = UUIDToBuffer(studentId);

        const { getCurrentSchoolYearService } = await import("./school-years.js");
        const currentSy = await getCurrentSchoolYearService(schoolId);
        if (!currentSy) {
            throw new BadRequestError("No current school year is set");
        }

        // Get enrolled classes with subjects
        const enrollQuery = `
            SELECT e.id as enrollment_id, e.class_id, c.class_name, c.section, c.grade_level,
                   es.subject_id, s.name as subject_name
            FROM enrollments e
            INNER JOIN classes c ON c.id = e.class_id
            INNER JOIN enrollment_subjects es ON es.enrollment_id = e.id
            INNER JOIN subjects s ON s.id = es.subject_id
            WHERE e.student_id = ? AND e.school_year_id = ? AND e.status = 'active'
            ORDER BY c.class_name, s.name
        `;
        const [enrollRows] = await connection.execute<RowDataPacket[]>(enrollQuery, [studentBuf, currentSy.id]);

        // Group by class+subject
        const subjectMap = new Map<string, { class_id: string; class_name: string; section: string | null; grade_level: number | null; subject_id: string; subject_name: string }>();
        for (const row of enrollRows as any[]) {
            const key = `${bufferToUUID(row.class_id)}-${bufferToUUID(row.subject_id)}`;
            if (!subjectMap.has(key)) {
                subjectMap.set(key, {
                    class_id: bufferToUUID(row.class_id),
                    class_name: row.class_name,
                    section: row.section,
                    grade_level: row.grade_level,
                    subject_id: bufferToUUID(row.subject_id),
                    subject_name: row.subject_name,
                });
            }
        }

        const results = [];
        for (const [, subj] of subjectMap) {
            const classBuf = UUIDToBuffer(subj.class_id);
            const subjectBuf = UUIDToBuffer(subj.subject_id);

            const items = await model.getGradeItems(classBuf, subjectBuf, undefined, periodId);
            const { items: studentItems, scores } = await model.getStudentGradesForSubject(studentBuf, classBuf, subjectBuf, periodId);
            const scoreMap = new Map<string, number>();
            for (const s of scores) {
                scoreMap.set(bufferToUUID(s.grade_item_id), Number(s.score));
            }

            const weights = await model.getGradingWeights(classBuf, subjectBuf, periodId);
            const weightMap = new Map<string, number>();
            for (const w of weights) {
                weightMap.set(w.category, Number(w.weight));
            }

            const attendanceRate = await model.getAttendanceRate(studentBuf, classBuf, subjectBuf, periodId);
            const hasAttendance = await model.hasAttendanceRecords(studentBuf, classBuf, subjectBuf, periodId);
            const teacherName = await model.getSubjectTeacher(classBuf, subjectBuf);

            // Compute averages
            const categories = ["activities", "quizzes", "exams"] as const;
            const categoryData: { activities: { items: { id: string; title: string; score: number | null; max_score: number; due_date: string | null }[]; average: number | null }; quizzes: { items: { id: string; title: string; score: number | null; max_score: number; due_date: string | null }[]; average: number | null }; exams: { items: { id: string; title: string; score: number | null; max_score: number; due_date: string | null }[]; average: number | null } } = {
                activities: { items: [], average: null },
                quizzes: { items: [], average: null },
                exams: { items: [], average: null },
            };
            for (const cat of categories) {
                const catItems = items.filter(i => i.category === cat);
                let sum = 0, max = 0, hasAny = false;
                const itemList = catItems.map(i => {
                    const iid = bufferToUUID(i.id);
                    const score = scoreMap.get(iid) ?? null;
                    if (score !== null) { sum += score; hasAny = true; }
                    max += Number(i.max_score);
                    return { id: iid, title: i.title, score, max_score: Number(i.max_score), due_date: i.due_date };
                });
                categoryData[cat] = {
                    items: itemList,
                    average: hasAny && max > 0 ? Math.round((sum / max) * 10000) / 100 : null,
                };
            }

            // Compute final grade using normalized weights
            const categoryAverages = new Map<string, number | null>([
                ["activities", categoryData.activities.average],
                ["quizzes", categoryData.quizzes.average],
                ["exams", categoryData.exams.average],
            ]);

            const finalGrade = computeNormalizedFinalGrade(
                categoryAverages,
                attendanceRate,
                hasAttendance,
                weightMap
            );

            results.push({
                subject_id: subj.subject_id,
                subject_name: subj.subject_name,
                class_id: subj.class_id,
                class_name: subj.class_name,
                section: subj.section,
                grade_level: subj.grade_level,
                teacher_name: teacherName || "",
                activities: categoryData.activities,
                quizzes: categoryData.quizzes,
                exams: categoryData.exams,
                attendance_rate: attendanceRate,
                grading_weights: weights.map(w => ({ category: w.category, weight: Number(w.weight) })),
                final_grade: finalGrade,
            });
        }

        return results;
    } finally {
        connection.release();
    }
};
