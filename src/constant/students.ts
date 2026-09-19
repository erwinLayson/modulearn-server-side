export interface StudentProp {
    id: Buffer;
    first_name: string;
    middle_name: string;
    last_name: string;
    extension_name: string;
    email: string;
    password: string;
    school_id: number;
    lrn: string;
    date_of_birth: string | null;
    place_of_birth: string;
    sex: "male" | "female";
    nationality: string;
    contact_number: string;
    region: string;
    province: string;
    city_municipality: string;
    barangay: string;
    purok_street: string;
    admin_id: Buffer;
    age?: number;
}

export interface StudentImportRow {
    first_name: string;
    middle_name?: string;
    last_name: string;
    extension_name?: string;
    email: string;
    lrn?: string;
    date_of_birth?: string;
    place_of_birth?: string;
    sex?: "male" | "female";
    nationality?: string;
    contact_number?: string;
    region?: string;
    province?: string;
    city_municipality?: string;
    barangay?: string;
    purok_street?: string;
}

export interface StudentLoginProp {
    email: string;
    password: string;
}
