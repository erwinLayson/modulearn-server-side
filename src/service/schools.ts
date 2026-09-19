import {databasePool} from "../config/database.js";

// ================ MODELS ==============
import SchoolModel from "../model/schools.js";
import SchoolAdminModel from "../model/school_admins.js";
import UserModel from "../model/users.js";

// Types 
import type{SchoolsProp} from "../constant/schools.js";
import type { SchoolAdminProp } from "../constant/schoolAdmins.js";


// Create new School
export const registerNewSchoolService = async (newSchool: SchoolsProp, schoolAdmin: SchoolAdminProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Insert into users table FIRST (school_admins.id FK references users.id)
        const userModel = new UserModel(connection);
        await userModel.createUser({
            id: schoolAdmin.id,
            email: schoolAdmin.email,
            password: schoolAdmin.password,
            role: "school_admin",
            school_id: schoolAdmin.school_id,
            status: "active",
            name: newSchool.school_admin,
        });

        const schoolAdminModel = new SchoolAdminModel(connection);
        await schoolAdminModel.registerNewSchoolAdmin(schoolAdmin)

        const schoolModel = new SchoolModel(connection);
        await schoolModel.registerSchool(newSchool);

        await connection.commit();
        return newSchool.id;
    }catch(err) {
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
