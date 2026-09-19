import {databasePool} from "../config/database.js";
import UserModel from "../model/users.js";
import {NotFoundError, BadRequestError} from "../helper/error.js";
import type{UserProp} from "../constant/users.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { hashPassword } from "../helper/hashPassword.js";
import { getEnvName } from "../helper/getEnv.js";

export const getAllUsersService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const userModel = new UserModel(connection);
        const users = await userModel.getAllUsers();
        return users.map(u => ({
            ...u,
            id: bufferToUUID(u.id),
        }));
    } finally {
        connection.release();
    }
};

export const getUserByIdService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const userModel = new UserModel(connection);
        const user = await userModel.getUserById(UUIDToBuffer(id));
        if(user === null) {
            throw new NotFoundError("User not found", 404);
        }
        return {
            ...user,
            id: bufferToUUID(user.id),
        };
    } finally {
        connection.release();
    }
};

export const createUserService = async (userData: Omit<UserProp, "id" | "created_at">) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const existing = await new UserModel(connection).getUserByEmail(userData.email);
        if (existing) {
            throw new BadRequestError("Email already exists");
        }

        const userModel = new UserModel(connection);
        const id = generateRandomUUID();
        const password = await hashPassword(userData.password);

        await userModel.createUser({
            ...userData,
            id,
            password,
        });

        return id;
    } finally {
        connection.release();
    }
};

export const updateUserService = async (id: string, data: Partial<Pick<UserProp, "email" | "role" | "school_id" | "status" | "name">>) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const userModel = new UserModel(connection);
        await userModel.updateUser(UUIDToBuffer(id), data);
    } finally {
        connection.release();
    }
};

export const deleteUserService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const userModel = new UserModel(connection);
        await userModel.deleteUser(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};