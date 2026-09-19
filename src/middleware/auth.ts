import type{Request, Response, NextFunction} from "express";
import {verifyToken} from "../helper/jwt.js";
import {UnauthorizedError, ForbiddenError} from "../helper/error.js";
import type{UserRole} from "../constant/users.js";

export const authMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const token = req.cookies?.token;

    if(!token) {
        throw new UnauthorizedError("No token provided");
    }

    try {
        const decoded = verifyToken(token);
        (req as Request & {user?: typeof decoded}).user = decoded;
        next();
    } catch(err) {
        throw new UnauthorizedError("Invalid or expired token");
    }
};

export const roleMiddleware = (...allowedRoles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = (req as Request & {user?: {role?: string}}).user;

        if(!user || !user.role) {
            throw new UnauthorizedError("Not authenticated");
        }

        if(!allowedRoles.includes(user.role as UserRole)) {
            throw new ForbiddenError("Insufficient permissions");
        }

        next();
    };
};
