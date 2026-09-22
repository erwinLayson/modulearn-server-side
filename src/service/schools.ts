import {databasePool} from "../config/database.js";

// ================ MODELS ==============
import SchoolModel from "../model/schools.js";
import SchoolAdminModel from "../model/school_admins.js";
import UserModel from "../model/users.js";
import SchoolYearModel from "../model/school-years.js";
import AcademicPeriodModel from "../model/academicPeriods.js";

// Types 
import type{SchoolsProp} from "../constant/schools.js";
import type { SchoolAdminProp } from "../constant/schoolAdmins.js";

// Helpers
import { normalizeEmail } from "../helper/normalizeEmail.js";


// Create new School
export const registerNewSchoolService = async (newSchool: SchoolsProp, schoolAdmin: SchoolAdminProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        // Disable FK checks to resolve circular dependency between
        // users → schools → school_admins → users
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");

        // Insert into users table FIRST
        const userModel = new UserModel(connection);
        await userModel.createUser({
            id: schoolAdmin.id,
            email: normalizeEmail(schoolAdmin.email),
            password: schoolAdmin.password,
            role: "school_admin",
            school_id: schoolAdmin.school_id,
            status: "active",
            name: newSchool.school_admin,
        });

        const schoolAdminModel = new SchoolAdminModel(connection);
        await schoolAdminModel.registerNewSchoolAdmin(schoolAdmin);

        const schoolModel = new SchoolModel(connection);
        await schoolModel.registerSchool(newSchool);

        // Auto-generate school years
        const syModel = new SchoolYearModel(connection);
        const now = new Date();
        const currentYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
        const nextYear = currentYear + 1;

        await syModel.create({
            id: 0,
            name: `${currentYear}-${nextYear}`,
            start_date: `${currentYear}-06-01`,
            end_date: `${nextYear}-05-31`,
            school_id: newSchool.school_id,
            is_current: 1,
        });

        await syModel.create({
            id: 0,
            name: `${nextYear}-${nextYear + 1}`,
            start_date: `${nextYear}-06-01`,
            end_date: `${nextYear + 1}-05-31`,
            school_id: newSchool.school_id,
            is_current: 0,
        });

        // Generate academic periods for the current school year
        const currentSy = await syModel.getCurrentBySchoolId(newSchool.school_id);
        if (currentSy) {
            const apModel = new AcademicPeriodModel(connection);
            const periodCount = newSchool.period_count;
            const academicSystem = newSchool.academic_system;

            const syStart = new Date(currentSy.start_date);
            const syEnd = new Date(currentSy.end_date);
            const totalDays = Math.floor((syEnd.getTime() - syStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const daysPerPeriod = Math.floor(totalDays / periodCount);

            for (let i = 1; i <= periodCount; i++) {
                const periodStart = new Date(syStart);
                periodStart.setDate(periodStart.getDate() + (i - 1) * daysPerPeriod);

                const periodEnd = new Date(syStart);
                if (i === periodCount) {
                    periodEnd.setTime(syEnd.getTime());
                } else {
                    periodEnd.setDate(periodEnd.getDate() + i * daysPerPeriod - 1);
                }

                const name = academicSystem === "quarter" ? `Quarter ${i}` : `Semester ${i}`;

                await apModel.create({
                    school_id: newSchool.school_id,
                    school_year_id: currentSy.id,
                    name,
                    period_number: i,
                    start_date: periodStart.toISOString().slice(0, 10),
                    end_date: periodEnd.toISOString().slice(0, 10),
                });
            }

            // Set first period as current
            const periods = await apModel.getBySchoolAndYear(newSchool.school_id, currentSy.id);
            if (periods.length > 0 && periods[0]) {
                await apModel.setCurrent(newSchool.school_id, currentSy.id, periods[0].id);
            }
        }

        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        await connection.commit();
        return newSchool.id;
    }catch(err) {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        await connection.rollback();
        throw err
    }finally {
        connection.release();
    }
};

export const getAllSchoolsService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const schoolModel = new SchoolModel(connection);
        return await schoolModel.getAllSchools();
    }finally {
        connection.release();
    }
};

export const getPublicSchoolListService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const query = `SELECT school_id, school_name FROM schools ORDER BY school_name`;
        const [rows] = await connection.execute(query);
        return rows;
    } finally {
        connection.release();
    }
};

export const getSchoolConfigService = async (schoolIdStr: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const schoolModel = new SchoolModel(connection);
        const schoolId = Number(schoolIdStr);
        const school = await schoolModel.getSchoolBySchoolId(schoolId);
        if (!school) {
            throw new (await import("../helper/error.js")).NotFoundError("School not found", 404);
        }
        return {
            school_id: school.school_id,
            academic_system: school.academic_system,
            period_count: school.period_count,
            academic_config_completed: school.academic_config_completed,
        };
    } finally {
        connection.release();
    }
};

export const updateSchoolConfigService = async (
    schoolIdStr: string,
    config: { academic_system?: string; period_count?: number }
) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const schoolModel = new SchoolModel(connection);
        const schoolId = Number(schoolIdStr);

        const school = await schoolModel.getSchoolBySchoolId(schoolId);
        if (!school) {
            throw new (await import("../helper/error.js")).NotFoundError("School not found", 404);
        }

        // Validate
        const validSystems = ["quarter", "semester"];
        if (config.academic_system && !validSystems.includes(config.academic_system)) {
            throw new (await import("../helper/error.js")).BadRequestError("Invalid academic system. Must be 'quarter' or 'semester'");
        }
        if (config.period_count !== undefined) {
            if (config.period_count < 1 || config.period_count > 6) {
                throw new (await import("../helper/error.js")).BadRequestError("Period count must be between 1 and 6");
            }
        }

        await schoolModel.updateSchoolConfig(schoolId, {
            ...config,
            academic_config_completed: 1,
        });

        return { message: "School config updated successfully" };
    } finally {
        connection.release();
    }
};
