import bcrypt from "bcrypt";
import {databasePool} from "../config/database.js";
import UserModel from "../model/users.js";
import SchoolModel from "../model/schools.js";
import FacultyModel from "../model/faculties.js";
import StudentModel from "../model/students.js";
import {NotFoundError, BadRequestError, UnauthorizedError} from "../helper/error.js";
import {generateToken} from "../helper/jwt.js";
import {bufferToUUID} from "../helper/bufferToUUID.js";
import {UUIDToBuffer} from "../helper/UUIDToBuffer.js";
import {normalizeEmail} from "../helper/normalizeEmail.js";

import type{UserRole} from "../constant/users.js";

export const authService = async (credentials: {email: string; password: string; school_id?: number}) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const userModel = new UserModel(connection);
        const normalizedEmail = normalizeEmail(credentials.email);

        let user;

        // Always try school-scoped login first
        if (credentials.school_id !== undefined && credentials.school_id !== null) {
            user = await userModel.getUserByEmailAndSchool(normalizedEmail, credentials.school_id);
        }

        // Fallback: try super-admin global lookup
        if (!user) {
            user = await userModel.getSuperAdminByEmail(normalizedEmail);
        }

        if (!user) {
            throw new NotFoundError("User not found in selected school", 404);
        }

        if (user.status !== "active") {
            throw new UnauthorizedError(`Account is ${user.status}`);
        }

        const passwordVerify = await bcrypt.compare(credentials.password, user.password);
        if (!passwordVerify) {
            throw new BadRequestError("Incorrect password");
        }

        const userId = bufferToUUID(user.id);
        const schoolId = user.school_id ?? 0;

        let profile: Record<string, unknown> = {};

        switch (user.role as UserRole) {
            case "super_admin": {
                profile = {
                    name: user.email,
                };
                break;
            }
            case "school_admin": {
                const schoolModel = new SchoolModel(connection);
                const schoolData = await schoolModel.getSchoolsData(UUIDToBuffer(userId));
                if (schoolData) {
                    profile = {
                        school_name: schoolData.school_name,
                        school_email: schoolData.school_email,
                        school_level: schoolData.school_level,
                        academic_system: schoolData.academic_system,
                        period_count: schoolData.period_count,
                        academic_config_completed: schoolData.academic_config_completed === 1,
                        address: schoolData.address,
                        region: schoolData.region,
                        province: schoolData.province,
                        city: schoolData.city,
                        contact_number: schoolData.contact_number,
                        school_logo: schoolData.school_logo,
                        school_admin: schoolData.school_admin,
                    };
                }
                break;
            }
            case "faculty": {
                const facultyModel = new FacultyModel(connection);
                const facultyData = await facultyModel.getFacultyById(UUIDToBuffer(userId));
                if (facultyData) {
                    profile = {
                        first_name: facultyData.first_name,
                        last_name: facultyData.last_name,
                        contact_number: facultyData.contact_number,
                        admin_id: bufferToUUID(facultyData.admin_id),
                    };
                }
                break;
            }
            case "student": {
                const studentModel = new StudentModel(connection);
                const studentData = await studentModel.getStudentById(UUIDToBuffer(userId));
                if (studentData) {
                    profile = {
                        first_name: studentData.first_name,
                        last_name: studentData.last_name,
                        contact_number: studentData.contact_number,
                        admin_id: bufferToUUID(studentData.admin_id),
                    };
                }
                break;
            }
            default: {
                break;
            }
        }

        const token = generateToken({id: userId, role: user.role, school_id: schoolId});

        return {
            token,
            user: {
                id: userId,
                email: user.email,
                role: user.role,
                school_id: schoolId,
                ...profile,
            },
        };
    } finally {
        connection.release();
    }
};
