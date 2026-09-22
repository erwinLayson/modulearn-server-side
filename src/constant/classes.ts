export interface ClassProp {
    id: Buffer;
    class_name: string;
    school_id: number;
    school_year_id: number;
    faculty_id: Buffer;
    capacity: number | null;
    section: string | null;
    grade_level: string | null;
    schedule: any | null;
    created_at?: Date;
}

export interface ClassWithDetails extends ClassProp {
    module_title: string;
    faculty_name: string;
}
