export interface SchoolAdminProp {
    id:Buffer;
    school_id: number;
    email: string;
    password: string;
}


export interface LoginCredentialsProp {
    email: string;
    password: string;
}