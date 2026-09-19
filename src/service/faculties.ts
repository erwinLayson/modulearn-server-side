import bcrypt from "bcrypt";
import {databasePool} from "../config/database.js";
import FacultyModel from "../model/faculties.js";
import UserModel from "../model/users.js";
import {NotFoundError, BadRequestError, ConflictError, UnauthorizedError} from "../helper/error.js";
import {generateToken} from "../helper/jwt.js";
import type{FacultyProp} from "../constant/faculties.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";

export const registerFacultyService = async (faculty: FacultyProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Insert into users table FIRST (faculties.id FK references users.id)
        const userModel = new UserModel(connection);
        await userModel.createUser({
            id: faculty.id,
            email: faculty.email,
            password: faculty.password,
            role: "faculty",
            school_id: faculty.school_id,
            status: "active",
            name: `${faculty.first_name} ${faculty.last_name}`,
        });

        const facultyModel = new FacultyModel(connection);
        await facultyModel.registerFaculty(faculty);

        await connection.commit();
        return faculty.id;
    } catch(err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

export const facultyLoginService = async (credentials: {email: string, password: string}) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        // Authenticate against users table
        const userModel = new UserModel(connection);
        const user = await userModel.getUserByEmail(credentials.email);

        if(user === null || user.role !== "faculty") {
            throw new NotFoundError("Faculty not found", 404);
        }

        if(user.status !== "active") {
            throw new UnauthorizedError(`Account is ${user.status}`);
        }

        const passwordVerify = await bcrypt.compare(credentials.password, user.password);
        if(!passwordVerify) {
            throw new BadRequestError("Incorrect password");
        }

        // Fetch faculty profile data
        const facultyModel = new FacultyModel(connection);
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const faculty = await facultyModel.getFacultyById(UUIDToBuffer(bufferToUUID(user.id)));

        const token = generateToken({
            id: bufferToUUID(user.id),
            role: "faculty",
            school_id: user.school_id ?? 0,
        });

        return {
            id: bufferToUUID(user.id),
            first_name: faculty?.first_name ?? "",
            last_name: faculty?.last_name ?? "",
            school_id: user.school_id ?? 0,
            admin_id: faculty ? bufferToUUID(faculty.admin_id) : "",
            token,
        };
    } finally {
        connection.release();
    }
};

export const getFacultiesBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const facultyModel = new FacultyModel(connection);
        const faculties = await facultyModel.getFacultiesBySchoolId(school_id);
        return faculties.map(t => ({
            ...t,
            id: bufferToUUID(t.id),
            admin_id: bufferToUUID(t.admin_id),
        }));
    } finally {
        connection.release();
    }
};

export const getFacultyByIdService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const facultyModel = new FacultyModel(connection);
        const faculty = await facultyModel.getFacultyById(UUIDToBuffer(id));
        if(faculty === null) {
            throw new NotFoundError("Faculty not found", 404);
        }
        return {
            ...faculty,
            id: bufferToUUID(faculty.id),
            admin_id: bufferToUUID(faculty.admin_id),
        };
    } finally {
        connection.release();
    }
};

export const updateFacultyService = async (id: string, data: Partial<Pick<FacultyProp, "first_name" | "last_name" | "email" | "contact_number" | "faculty_role">>) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const facultyModel = new FacultyModel(connection);
        await facultyModel.updateFaculty(UUIDToBuffer(id), data);
    } finally {
        connection.release();
    }
};

export const deleteFacultyService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const facultyModel = new FacultyModel(connection);
        await facultyModel.deleteFaculty(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};
