export type UserRole = "super_admin" | "school_admin" | "faculty" | "student";
export type UserStatus = "active" | "inactive" | "suspended";

export const MIN_PASSWORD_LENGTH = 6;

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