import bcrypt from "bcrypt";

import {databasePool} from "../config/database.js";

// ================= MODELS ===============
import SchoolModel from "../model/schools.js";
import UserModel from "../model/users.js";

//  ================== HELPERS =================
import {NotFoundError, BadRequestError, UnauthorizedError} from "../helper/error.js";
import {generateToken} from "../helper/jwt.js";


//  ======================= Types ================
import type{ LoginCredentialsProp } from "../constant/schoolAdmins.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";

export const schoolAdminLoginService = async (credentials: LoginCredentialsProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        // Authenticate against users table
        const userModel = new UserModel(connection);
        const user = await userModel.getUserByEmail(credentials.email);

        if(user === null || user.role !== "school_admin") {
            throw new NotFoundError(`${credentials.email} is not registered`, 404);
        }

        if(user.status !== "active") {
            throw new UnauthorizedError(`Account is ${user.status}`);
        }

        const password = credentials.password.toString()

        const passwordVerify = await bcrypt.compare(password, user.password);
        if(!passwordVerify) {
            throw new BadRequestError('Incorrect password');
        }

        // Fetch school data
        const schoolModel = new SchoolModel(connection);
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const schooldata = await schoolModel.getSchoolsData(UUIDToBuffer(bufferToUUID(user.id)));

        if(schooldata === null || schooldata === undefined) {
            throw new UnauthorizedError("Your ID are not authorized to access any school data");
        }

        const token = generateToken({
            id: bufferToUUID(user.id),
            role: "school_admin",
            school_id: user.school_id ?? 0,
        });

        return {
            ...schooldata,
            id: bufferToUUID(schooldata.id),
            admin_id: bufferToUUID(schooldata.admin_id),
            academic_config_completed: schooldata.academic_config_completed === 1,
            token,
        };
    }finally {
        connection.release();
    }
}
