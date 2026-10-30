import type { LessonType } from "./moduleLessons.js";

export interface LessonClassAssignmentRow {
    class_module_id: Buffer;
    classroom_id: Buffer;
    class_name: string;
    school_year_id: number;
    school_year_name: string;
    school_year_is_current: number;
    assigned: number;
}

export interface StudentLessonRow {
    assignment_id: Buffer;
    lesson_id: Buffer;
    module_id: Buffer;
    module_title: string;
    subject_name: string | null;
    teacher_first_name: string | null;
    teacher_last_name: string | null;
    class_id: Buffer;
    class_name: string;
    school_year_id: number;
    school_year_name: string;
    title: string;
    lesson_type: LessonType;
    content: string | null;
    file_name: string | null;
    file_path: string | null;
    file_type: string | null;
    file_size: number | string | null;
    sort_order: number | string;
    assigned_at: Date | string;
}

export interface StudentLessonFileRow {
    file_name: string | null;
    file_path: string;
    file_type: string | null;
}
