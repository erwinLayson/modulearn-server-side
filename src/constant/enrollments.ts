export interface EnrollmentProp {
    id: Buffer;
    student_id: Buffer;
    class_id: Buffer;
    school_year_id: number | null;
    grade_level: number | null;
    status: "active" | "dropped" | "completed";
}

export interface EnrollmentWithDetails {
    id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    class_id: string;
    class_name: string;
    section: string | null;
    grade_level: string | null;
    school_year_id: number | null;
    school_year_name: string | null;
    status: "active" | "dropped" | "completed";
    enrolled_at: string;
    subjects: { id: string; name: string; teacher_name: string | null }[];
}
