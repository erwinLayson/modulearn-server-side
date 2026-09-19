import type{Request, Response, NextFunction} from "express";
import {databasePool} from "../config/database.js";
import {ForbiddenError} from "../helper/error.js";
import type{TokenPayload} from "../helper/jwt.js";
import type{UserRole} from "../constant/users.js";

function getUser(req: Request): TokenPayload | null {
    return (req as Request & {user?: TokenPayload}).user ?? null;
}

/**
 * For write endpoints (POST/PUT/DELETE):
 * Overrides req.body.school_id with the JWT's school_id for school_admin.
 * Also overrides admin_id if present.
 * super_admin passes through unchanged.
 */
export const enforceSchoolScope = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const user = getUser(req);
    if (!user) {
        return next(new ForbiddenError("Not authenticated"));
    }

    if (user.role === "school_admin") {
        if (user.school_id === undefined) {
            return next(new ForbiddenError("School ID not found in token"));
        }
        if (req.body && typeof req.body === "object") {
            req.body.school_id = user.school_id;
            if ("admin_id" in req.body) {
                req.body.admin_id = user.id;
            }
        }
    }

    next();
};

/**
 * For GET endpoints that take school_id as a URL param.
 * Overrides req.params.school_id with the JWT's school_id for school_admin.
 * super_admin passes through unchanged.
 */
export const enforceSchoolParam = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const user = getUser(req);
    if (!user) {
        return next(new ForbiddenError("Not authenticated"));
    }

    if (user.role === "school_admin") {
        if (user.school_id === undefined) {
            return next(new ForbiddenError("School ID not found in token"));
        }
        req.params.school_id = String(user.school_id);
    }

    next();
};

/**
 * Factory: returns middleware that verifies the resource belongs to the user's school.
 * For GET/PUT/DELETE endpoints by :id param.
 * super_admin passes through.
 *
 * Usage: verifyOwnership('students') or verifyOwnership('classes', 'school_id')
 */
export const verifyOwnership = (
    table: string,
    schoolIdColumn: string = "school_id"
): (req: Request<{id: string}>, _res: Response, next: NextFunction) => Promise<void> => {
    return async (
        req: Request<{id: string}>,
        _res: Response,
        next: NextFunction
    ) => {
        const user = getUser(req);
        if (!user) {
            return next(new ForbiddenError("Not authenticated"));
        }

        // super_admin can access any resource
        if (user.role === "super_admin") {
            return next();
        }

        if (user.school_id === undefined) {
            return next(new ForbiddenError("School ID not found in token"));
        }

        const {id} = req.params;
        if (!id) {
            return next();
        }

        try {
            const pool = databasePool();
            const [rows] = await pool.execute(
                `SELECT ${schoolIdColumn} FROM ${table} WHERE id = ? LIMIT 1`,
                [Buffer.from(id.replace(/-/g, ""), "hex")]
            );

            const result = rows as {[key: string]: unknown}[];
            if (result.length === 0) {
                return next(new ForbiddenError("Resource not found"));
            }

            const row = result[0]!;
            const resourceSchoolId = row[schoolIdColumn] as number | undefined;
            if (resourceSchoolId === undefined || resourceSchoolId !== user.school_id) {
                return next(new ForbiddenError("Access denied: cross-school violation"));
            }

            next();
        } catch(err) {
            next(err);
        }
    };
};
