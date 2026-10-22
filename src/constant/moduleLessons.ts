export type LessonType = "text" | "file";

export interface ModuleLessonRow {
    id: Buffer;
    module_id: Buffer;
    title: string;
    lesson_type: LessonType;
    content: string | null;
    file_name: string | null;
    file_path: string | null;
    file_type: string | null;
    file_size: number | null;
    sort_order: number;
    created_at: Date;
    updated_at: Date | null;
}

export interface SerializedModuleLesson {
    id: string;
    module_id: string;
    title: string;
    lesson_type: LessonType;
    content: string | null;
    file_name: string | null;
    file_path: string | null;
    file_type: string | null;
    file_size: number | null;
    sort_order: number;
    created_at: string;
    updated_at: string | null;
}

export interface ModuleLessonInsertProp {
    id: Buffer;
    module_id: Buffer;
    title: string;
    lesson_type: LessonType;
    content?: string | null;
    file_name?: string | null;
    file_path?: string | null;
    file_type?: string | null;
    file_size?: number | null;
    sort_order?: number;
}

export interface ModuleLessonUpdateProp {
    title?: string;
    lesson_type?: LessonType;
    content?: string | null;
    file_name?: string | null;
    file_path?: string | null;
    file_type?: string | null;
    file_size?: number | null;
    sort_order?: number;
}
