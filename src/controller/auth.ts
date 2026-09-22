import type{Request, Response, NextFunction} from "express";
import type { TokenPayload } from "../helper/jwt.js";
import {authService} from "../service/auth.js";
import {updateCredentialsService} from "../service/users.js";
import {CheckData} from "../helper/checkdata.js";
import {sendSuccess} from "../helper/sendSuccess.js";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.SYSTEM_STATUS === "production",
    sameSite: "lax" as const,
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
};

export const loginController = async (
    req: Request<{}, {}, {email: string; password: string; school_id?: number}>,
    res: Response,
    next: NextFunction
) => {
    const {email, password, school_id} = req.body;

    CheckData({email, password});

    try {
        const credentials: { email: string; password: string; school_id?: number } = { email, password };
        if (school_id !== undefined) credentials.school_id = school_id;
        const result = await authService(credentials);
        const {token, ...userData} = result;

        res.cookie("token", token, COOKIE_OPTIONS);
        sendSuccess(res, "Login successful", userData);
    } catch (err) {
        next(err);
    }
};

export const updateCredentialsController = async (
    req: Request<{}, {}, { current_password: string; email?: string; password?: string }> & { user?: TokenPayload },
    res: Response,
    next: NextFunction
) => {
    const { current_password, email, password } = req.body;

    CheckData({ current_password });

    if (!email && !password) {
        return sendSuccess(res, "Nothing to update", undefined, 200);
    }

    try {
        const userId = req.user!.id;
        const updates: { email?: string; password?: string } = {};
        if (email !== undefined) updates.email = email;
        if (password !== undefined) updates.password = password;
        await updateCredentialsService(userId, current_password, updates);
        sendSuccess(res, "Credentials updated successfully");
    } catch (err) {
        next(err);
    }
};
