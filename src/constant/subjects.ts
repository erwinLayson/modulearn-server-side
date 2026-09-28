export interface SubjectProp {
    id: Buffer;
    name: string;
    subject_code: string | null;
    description: string | null;
    school_id: number;
    admin_id: Buffer;
    is_active?: number;
    created_at: Date;
    updated_at: Date | null;
}

export interface SubjectPayload {
    name: string;
    subject_code?: string | null;
    description?: string | null;
    school_id: number;
    admin_id: Buffer;
}