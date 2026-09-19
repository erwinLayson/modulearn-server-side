export interface ModuleProp {
    id: Buffer;
    title: string;
    description: string;
    subject: string;
    subject_id: Buffer | null;
    school_id: number;
    admin_id: Buffer;
}
