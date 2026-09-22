export interface AcademicPeriodProp {
    id: number;
    school_id: number;
    school_year_id: number;
    name: string;
    period_number: number;
    start_date: string;
    end_date: string;
    is_current: number;
}

export type CreateAcademicPeriodProp = Omit<AcademicPeriodProp, "id" | "is_current">;
