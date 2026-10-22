import type { GradeItemCategory } from "./gradebook.js";

export interface ModuleActivityTemplateProp {
    id: Buffer;
    module_id: Buffer;
    title: string;
    instructions: string | null;
    category: GradeItemCategory;
    max_score: number;
    sort_order: number;
    created_at?: Date;
    updated_at?: Date | null;
}

export interface ModuleActivityTemplatePayload {
    title: string;
    instructions?: string | null;
    category?: GradeItemCategory;
    max_score: number;
    sort_order?: number;
}

export type ModuleActivityTemplateUpdatePayload = Partial<ModuleActivityTemplatePayload>;
