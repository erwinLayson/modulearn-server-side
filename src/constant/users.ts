export type UserRole = "super_admin" | "school_admin" | "faculty" | "student";
export type UserStatus = "active" | "inactive" | "suspended";

export interface UserProp {
    id: Buffer;
    email: string;
    password: string;
    role: UserRole;
    school_id: number | null;
    status: UserStatus;
    name: string;
    created_at?: Date;
}