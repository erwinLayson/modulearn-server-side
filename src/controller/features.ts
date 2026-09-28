import type{Request, Response, NextFunction} from "express";
import type{TokenPayload} from "../helper/jwt.js";

import {getSchoolFeaturesService, updateSchoolFeaturesService} from "../service/features.js";
import {ForbiddenError} from "../helper/error.js";
import {UUIDToBuffer} from "../helper/UUIDToBuffer.js";
import {sendSuccess} from "../helper/sendSuccess.js";

type AuthedRequest = Request & {user?: TokenPayload};

// --- Get the feature switches of a school ---
// super_admin may read any school; everyone else only their own school.
export const getSchoolFeatures = async (
    req: Request<{id: string}> & {user?: TokenPayload},
    res: Response,
    next: NextFunction
) => {
    try {
        const {id} = req.params;
        const user = (req as AuthedRequest).user;
        if (user?.role !== "super_admin" && Number(id) !== user?.school_id) {
            throw new ForbiddenError("Access denied: cross-school violation");
        }
        const result = await getSchoolFeaturesService(id);
        sendSuccess(res, "School features retrieved", result);
    } catch (err) {
        next(err);
    }
};

// --- Update the feature switches of a school (super_admin only) ---
export const updateSchoolFeatures = async (
    req: Request<{id: string}, {}, {features?: {key: string; is_enabled: boolean}[]}> & {user?: TokenPayload},
    res: Response,
    next: NextFunction
) => {
    try {
        const {id} = req.params;
        const user = (req as AuthedRequest).user;
        const updatedBy = user?.id ? UUIDToBuffer(user.id) : null;
        const result = await updateSchoolFeaturesService(id, req.body.features ?? [], updatedBy);
        sendSuccess(res, "School features updated", result);
    } catch (err) {
        next(err);
    }
};
