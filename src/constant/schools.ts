export interface SchoolsProp {
    id: Buffer,
    school_name: string;
    school_id: number;
    school_email: string;
    school_level: number;
    academic_system: string;
    period_count: number;
    academic_config_completed: number;
    address: string;
    region: string;
    province: string;
    city: string;
    contact_number: string;
    school_logo: string;
    school_admin: string;
    admin_id: Buffer;
}

export type PartialSchoolProps = Omit<SchoolsProp, "admin_id"> & Partial<Pick<SchoolsProp, "admin_id">>