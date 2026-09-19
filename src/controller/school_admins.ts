import type{Request, Response, NextFunction} from "express";
import {sendSuccess} from "../helper/sendSuccess.js";

export const logoutController = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.SYSTEM_STATUS === "production",
            sameSite: "lax",
            path: "/",
        });
        sendSuccess(res, "Logged out successfully");
    } catch(err) {
        next(err);
    }
};
