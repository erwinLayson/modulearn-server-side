import type{Request, Response, NextFunction} from "express";
import {authService} from "../service/auth.js";
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
    req: Request<{}, {}, {email: string; password: string}>,
    res: Response,
    next: NextFunction
) => {
    const {email, password} = req.body;

    CheckData({email, password});

    try {
        const result = await authService({email, password});
        const {token, ...userData} = result;

        res.cookie("token", token, COOKIE_OPTIONS);
        sendSuccess(res, "Login successful", userData);
    } catch (err) {
        next(err);
    }
};
