import type { GradeItemCategory } from "./gradebook.js";
import type { ModuleStatus } from "./modules.js";

export interface ClassModuleProp {
    id: Buffer;
    module_id: Buffer;
    classroom_id: Buffer;
    school_year_id: number;
    assigned_at: Date;
}

export interface ClassModuleAssignmentRow {
    id: Buffer;
    module_id: Buffer;
    classroom_id: Buffer;
    class_name: string;
    school_year_id: number;
    school_year_name: string;
    assigned_at: Date;
}

export interface EligibleClassroomRow {
    classroom_id: Buffer;
    class_name: string;
    section: string | null;
    grade_level: string | null;
    school_year_id: number;
    school_year_name: string;
    class_module_id: Buffer | null;
}

export interface ClassModuleDetailRow {
    id: Buffer;
    module_id: Buffer;
    classroom_id: Buffer;
    class_name: string;
    school_year_id: number;
    school_year_name: string;
    assigned_at: Date;
    title: string;
    description: string | null;
    lesson_content: string | null;
    subject_id: Buffer;
    subject_name: string;
    status: ModuleStatus;
    owner_faculty_id: Buffer | null;
}

export interface ClassModuleWithModuleRow extends ClassModuleProp {
    title: string;
    description: string | null;
    lesson_content: string | null;
    subject_id: Buffer;
    subject_name: string;
    status: ModuleStatus;
    owner_faculty_id: Buffer | null;
    class_name: string;
    school_year_name: string;
}

export interface TemplateSnapshotRow {
    id: Buffer;
    module_id: Buffer;
    title: string;
    instructions: string | null;
    category: GradeItemCategory;
    max_score: number;
    sort_order: number;
}
