export type GradingCategory = "activities" | "quizzes" | "exams" | "attendance";
export type GradeItemCategory = "activities" | "quizzes" | "exams";

export const GRADING_CATEGORIES: GradingCategory[] = ["activities", "quizzes", "exams", "attendance"];
export const GRADE_ITEM_CATEGORIES: GradeItemCategory[] = ["activities", "quizzes", "exams"];

export interface GradingWeightProp {
    id: number;
    class_id: Buffer;
    subject_id: Buffer;
    category: GradingCategory;
    weight: number;
    period_id: number | null;
}

export interface GradeItemProp {
    id: Buffer;
    class_id: Buffer;
    subject_id: Buffer;
    faculty_id: Buffer;
    category: GradeItemCategory;
    title: string;
    max_score: number;
    due_date: string | null;
    period_id: number | null;
}

export interface GradeProp {
    id: number;
    grade_item_id: Buffer;
    student_id: Buffer;
    score: number;
    recorded_by: Buffer;
}

export interface GradeItemWithScores extends GradeItemProp {
    scores: { student_id: string; student_name: string; score: number | null }[];
}

export interface StudentSubjectGradeSummary {
    subject_id: string;
    subject_name: string;
    class_id: string;
    class_name: string;
    teacher_name: string;
    activities: { item_id: string; title: string; score: number | null; max_score: number }[];
    activities_average: number | null;
    quizzes: { item_id: string; title: string; score: number | null; max_score: number }[];
    quizzes_average: number | null;
    exams: { item_id: string; title: string; score: number | null; max_score: number }[];
    exams_average: number | null;
    attendance_rate: number;
    grading_weights: { category: GradingCategory; weight: number }[];
    final_grade: number | null;
}
