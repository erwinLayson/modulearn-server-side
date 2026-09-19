export type FacultyRole = "teacher" | "cashier" | "register";

export interface FacultyProp {
    id: Buffer;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    school_id: number;
    contact_number: string;
    admin_id: Buffer;
    faculty_role: FacultyRole;
}

export interface FacultyLoginProp {
    email: string;
    password: string;
}
