export type ModuleStatus = "draft" | "published" | "archived";

export const MODULE_STATUSES: ModuleStatus[] = ["draft", "published", "archived"];

export interface ModuleProp {
    id: Buffer;
    title: string;
    description: string | null;
    subject: string;
    subject_id: Buffer | null;
    school_id: number;
    admin_id: Buffer | null;
    owner_faculty_id: Buffer | null;
    status: ModuleStatus;
    lesson_content: string | null;
    created_at?: Date;
    updated_at?: Date | null;
}

export interface ModuleListRow extends ModuleProp {
    template_count: number;
    assignment_count: number;
}

export interface ModuleListFilters {
    q?: string;
    status?: ModuleStatus;
    subject_id?: Buffer;
}

export interface ModuleAssignmentRow {
    id: Buffer;
    module_id: Buffer;
    classroom_id: Buffer;
    class_name: string;
    school_year_id: number;
    school_year_name: string;
    assigned_at: Date;
}

export interface TeacherModulePayload {
    title: string;
    description?: string | null;
    subject_id: string;
    lesson_content?: string | null;
    status?: ModuleStatus;
}

export type TeacherModuleUpdatePayload = Partial<TeacherModulePayload>;
