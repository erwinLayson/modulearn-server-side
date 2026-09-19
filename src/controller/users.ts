import type{Request, Response, NextFunction} from "express";

import type{UserProp} from "../constant/users.js";

import { getAllUsersService, getUserByIdService, createUserService, updateUserService, deleteUserService } from "../service/users.js";
import {BadRequestError} from "../helper/error.js";

import {CheckData} from "../helper/checkdata.js";
import {sendSuccess} from "../helper/sendSuccess.js";

export const getAllUsers = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const users = await getAllUsersService();
        sendSuccess(res, "Users retrieved", users);
    } catch(err) {
        next(err);
    }
};

export const getUserById = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        const user = await getUserByIdService(id);
        sendSuccess(res, "User retrieved", user);
    } catch(err) {
        next(err);
    }
};

export const createUser = async (
    req: Request<{}, {}, Omit<UserProp, "id" | "created_at">>,
    res: Response,
    next: NextFunction
) => {
    const {
        email, password, role, school_id, status, name
    } = req.body;

    const userData = {
        email,
        password,
        role,
        school_id,
        status,
        name,
    };

    CheckData(userData);

    try {
        await createUserService(userData);
        sendSuccess(res, "User created successfully", undefined, 201);
    } catch(err) {
        next(err);
    }
};

export const updateUser = async (
    req: Request<{id: string}, {}, Partial<Pick<UserProp, "email" | "role" | "school_id" | "status" | "name">>>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;
    const data = req.body;

    try {
        await updateUserService(id, data);
        sendSuccess(res, "User updated successfully");
    } catch(err) {
        next(err);
    }
};

export const deleteUser = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction
) => {
    const {id} = req.params;

    try {
        await deleteUserService(id);
        sendSuccess(res, "User deleted successfully");
    } catch(err) {
        next(err);
    }
};