import type{Request, Response, NextFunction} from "express";
import {databasePool} from "../config/database.js";
import SchoolFeaturesModel from "../model/schoolFeatures.js";
import {ForbiddenError} from "../helper/error.js";
import {FEATURE_LABELS} from "../constant/features.js";
import type{FeatureKey} from "../constant/features.js";
import type{TokenPayload} from "../helper/jwt.js";

function getUser(req: Request): TokenPayload | null {
    return (req as Request & {user?: TokenPayload}).user ?? null;
}

/**
 * Blocks the request when the school tied to the caller's token has any of the
 * given features switched off by the super admin.
 *
 * super_admin is never blocked (they own the switches), and a token without a
 * school_id is left alone. Enforcement is what makes the client-side hiding
 * non-bypassable, so it must stay on every route backing a toggleable feature.
 *
 * Usage: requireFeature("gradebook") or requireFeature("attendance", "attendance_reports")
 */
export const requireFeature = (...keys: FeatureKey[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const user = getUser(req);

        if (!user) {
            return next(new ForbiddenError("Not authenticated"));
        }

        // The super admin manages the switches, so they always get through.
        if (user.role === "super_admin" || user.school_id === undefined) {
            return next();
        }

        try {
            const pool = databasePool();
            const connection = await pool.getConnection();
            try {
                const model = new SchoolFeaturesModel(connection);
                for (const key of keys) {
                    const enabled = await model.isEnabled(user.school_id, key);
                    if (!enabled) {
                        return next(
                            new ForbiddenError(
                                `${FEATURE_LABELS[key]} is not available for this school`
                            )
                        );
                    }
                }
            } finally {
                connection.release();
            }

            next();
        } catch(err) {
            next(err);
        }
    };
};
