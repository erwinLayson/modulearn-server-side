import type { RowDataPacket } from "mysql2/promise";
import { databasePool } from "../config/database.js";
import AcademicPeriodModel from "../model/academicPeriods.js";
import SchoolYearModel from "../model/school-years.js";
import type { CreateAcademicPeriodProp } from "../constant/academicPeriods.js";
import { NotFoundError, BadRequestError } from "../helper/error.js";

// --- List periods for a school year ---
export const getPeriodsBySchoolAndYearService = async (schoolId: number, schoolYearId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);
        return await model.getBySchoolAndYear(schoolId, schoolYearId);
    } finally {
        connection.release();
    }
};

// --- Get current period ---
export const getCurrentPeriodService = async (schoolId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);
        return await model.getCurrentBySchool(schoolId);
    } finally {
        connection.release();
    }
};

// --- Get period by ID ---
export const getPeriodByIdService = async (id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);
        return await model.getById(id);
    } finally {
        connection.release();
    }
};

// --- Create a period ---
export const createPeriodService = async (period: CreateAcademicPeriodProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);

        if (!period.name || period.name.trim().length === 0) {
            throw new BadRequestError("Period name is required");
        }
        if (period.period_number < 1) {
            throw new BadRequestError("Period number must be at least 1");
        }
        if (period.start_date > period.end_date) {
            throw new BadRequestError("Start date must be before or equal to end date");
        }

        // Check period_number uniqueness
        const numExists = await model.existsBySchoolAndYear(period.school_id, period.school_year_id, period.period_number);
        if (numExists) {
            throw new BadRequestError(`Period number ${period.period_number} already exists for this school year`);
        }

        // Check name uniqueness
        const nameExists = await model.nameExistsBySchoolAndYear(period.school_id, period.school_year_id, period.name);
        if (nameExists) {
            throw new BadRequestError(`Period name "${period.name}" already exists for this school year`);
        }

        // Check overlap
        const overlaps = await model.checkOverlap(period.school_id, period.school_year_id, period.start_date, period.end_date);
        if (overlaps) {
            throw new BadRequestError("Period dates overlap with an existing period");
        }

        return await model.create(period);
    } finally {
        connection.release();
    }
};

// --- Update a period ---
export const updatePeriodService = async (
    id: number,
    schoolId: number,
    data: { name?: string; start_date?: string; end_date?: string }
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);
        const existing = await model.getById(id);
        if (!existing) {
            throw new NotFoundError("Academic period not found", 404);
        }
        if (existing.school_id !== schoolId) {
            throw new NotFoundError("Academic period not found", 404);
        }

        const finalName = data.name ?? existing.name;
        const finalStart = data.start_date ?? existing.start_date;
        const finalEnd = data.end_date ?? existing.end_date;

        if (finalStart > finalEnd) {
            throw new BadRequestError("Start date must be before or equal to end date");
        }

        // Check name uniqueness if changed
        if (data.name && data.name !== existing.name) {
            const nameExists = await model.nameExistsBySchoolAndYear(schoolId, existing.school_year_id, data.name, id);
            if (nameExists) {
                throw new BadRequestError(`Period name "${data.name}" already exists for this school year`);
            }
        }

        // Check overlap if dates changed
        if (data.start_date || data.end_date) {
            const overlaps = await model.checkOverlap(schoolId, existing.school_year_id, finalStart, finalEnd, id);
            if (overlaps) {
                throw new BadRequestError("Period dates overlap with an existing period");
            }
        }

        await model.update(id, data);
        return await model.getById(id);
    } finally {
        connection.release();
    }
};

// --- Delete a period ---
export const deletePeriodService = async (id: number, schoolId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);
        const existing = await model.getById(id);
        if (!existing) {
            throw new NotFoundError("Academic period not found", 404);
        }
        if (existing.school_id !== schoolId) {
            throw new NotFoundError("Academic period not found", 404);
        }

        // Check if period has records
        const records = await model.countRecordsByPeriod(id, schoolId);
        if (records.gradeItems > 0 || records.attendance > 0) {
            throw new BadRequestError(
                `Cannot delete this period. It contains ${records.gradeItems} grade item(s) and ${records.attendance} attendance record(s).`
            );
        }

        await model.delete(id);
    } finally {
        connection.release();
    }
};

// --- Set current period ---
export const setCurrentPeriodService = async (id: number, schoolId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);
        const existing = await model.getById(id);
        if (!existing) {
            throw new NotFoundError("Academic period not found", 404);
        }
        if (existing.school_id !== schoolId) {
            throw new NotFoundError("Academic period not found", 404);
        }

        await model.setCurrent(schoolId, existing.school_year_id, id);
    } finally {
        connection.release();
    }
};

// --- Generate missing periods (Phase 3) ---
export const generatePeriodsService = async (schoolId: number, schoolYearId: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new AcademicPeriodModel(connection);

        // Get school config from the schools table
        const [schoolRows] = await connection.execute<RowDataPacket[]>(
            `SELECT academic_system, period_count FROM schools WHERE school_id = ?`,
            [schoolId]
        );
        if (schoolRows.length === 0) {
            throw new NotFoundError("School not found", 404);
        }
        const schoolConfig = schoolRows[0] as { academic_system?: string; period_count?: number };
        if (!schoolConfig.academic_system || !schoolConfig.period_count) {
            throw new BadRequestError("School has no academic configuration");
        }
        const academicSystem = schoolConfig.academic_system;
        const periodCount = schoolConfig.period_count;

        // Get school year
        const syModel = new SchoolYearModel(connection);
        const schoolYear = await syModel.getById(schoolYearId);
        if (!schoolYear || schoolYear.school_id !== schoolId) {
            throw new NotFoundError("School year not found", 404);
        }

        // Check existing periods
        const existingCount = await model.countBySchoolAndYear(schoolId, schoolYearId);
        if (existingCount >= periodCount) {
            return { message: "All periods already exist", generated: 0 };
        }

        // Find which period_numbers are missing
        const existingPeriods = await model.getBySchoolAndYear(schoolId, schoolYearId);
        const existingNumbers = new Set(existingPeriods.map(p => p.period_number));

        // Generate default dates
        const syStart = new Date(schoolYear.start_date);
        const syEnd = new Date(schoolYear.end_date);
        const totalDays = Math.floor((syEnd.getTime() - syStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysPerPeriod = Math.floor(totalDays / periodCount);

        let generated = 0;

        for (let i = 1; i <= periodCount; i++) {
            if (existingNumbers.has(i)) continue;

            const periodStart = new Date(syStart);
            periodStart.setDate(periodStart.getDate() + (i - 1) * daysPerPeriod);

            const periodEnd = new Date(syStart);
            if (i === periodCount) {
                periodEnd.setTime(syEnd.getTime());
            } else {
                periodEnd.setDate(periodEnd.getDate() + i * daysPerPeriod - 1);
            }

            const name = academicSystem === "quarter" ? `Quarter ${i}` : `Semester ${i}`;

            // Check name uniqueness (in case of collision with existing)
            let finalName = name;
            let suffix = 2;
            while (await model.nameExistsBySchoolAndYear(schoolId, schoolYearId, finalName)) {
                finalName = `${name} (${suffix})`;
                suffix++;
            }

            await model.create({
                school_id: schoolId,
                school_year_id: schoolYearId,
                name: finalName,
                period_number: i,
                start_date: periodStart.toISOString().slice(0, 10),
                end_date: periodEnd.toISOString().slice(0, 10),
            });
            generated++;
        }

        // Set first period as current if no current exists
        if (existingCount === 0 && generated > 0) {
            const firstPeriod = (await model.getBySchoolAndYear(schoolId, schoolYearId))[0];
            if (firstPeriod) {
                await model.setCurrent(schoolId, schoolYearId, firstPeriod.id);
            }
        }

        return { message: `Generated ${generated} period(s)`, generated };
    } finally {
        connection.release();
    }
};
