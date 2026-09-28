import {databasePool} from "../config/database.js";

// ================ MODELS ==============
import SchoolModel from "../model/schools.js";
import SchoolFeaturesModel from "../model/schoolFeatures.js";

// Types
import {FEATURES, isFeatureKey} from "../constant/features.js";
import type {FeatureKey} from "../constant/features.js";

// Helpers
import {NotFoundError, BadRequestError} from "../helper/error.js";

export interface SchoolFeatureState {
    key: FeatureKey;
    label: string;
    description: string;
    is_enabled: boolean;
}

export interface UpdateFeatureEntry {
    key: string;
    is_enabled: boolean;
}

/** Resolves the catalog against the school's stored rows (absent row = enabled). */
const buildFeatureState = (
    stored: {feature_key: string; is_enabled: number}[]
): SchoolFeatureState[] => {
    const storedMap = new Map(stored.map(row => [row.feature_key, row.is_enabled === 1]));
    return FEATURES.map(feature => ({
        key: feature.key,
        label: feature.label,
        description: feature.description,
        is_enabled: storedMap.get(feature.key) ?? true,
    }));
};

const assertSchoolExists = async (
    schoolModel: SchoolModel,
    schoolId: number
): Promise<void> => {
    const school = await schoolModel.getSchoolBySchoolId(schoolId);
    if (!school) {
        throw new NotFoundError("School not found", 404);
    }
};

export const getSchoolFeaturesService = async (
    schoolIdStr: string
): Promise<{school_id: number; features: SchoolFeatureState[]}> => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const schoolId = Number(schoolIdStr);
        if (!Number.isFinite(schoolId) || schoolId <= 0) {
            throw new BadRequestError("Invalid school id");
        }

        const schoolModel = new SchoolModel(connection);
        await assertSchoolExists(schoolModel, schoolId);

        const model = new SchoolFeaturesModel(connection);
        const stored = await model.getBySchoolId(schoolId);

        return {school_id: schoolId, features: buildFeatureState(stored)};
    } finally {
        connection.release();
    }
};

export const updateSchoolFeaturesService = async (
    schoolIdStr: string,
    entries: UpdateFeatureEntry[],
    updatedBy: Buffer | null
): Promise<{school_id: number; features: SchoolFeatureState[]}> => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const schoolId = Number(schoolIdStr);
        if (!Number.isFinite(schoolId) || schoolId <= 0) {
            throw new BadRequestError("Invalid school id");
        }

        const schoolModel = new SchoolModel(connection);
        await assertSchoolExists(schoolModel, schoolId);

        if (!Array.isArray(entries) || entries.length === 0) {
            throw new BadRequestError("No features provided");
        }

        // Last write wins if a key is repeated.
        const deduped = new Map<FeatureKey, boolean>();
        for (const entry of entries) {
            if (!entry || typeof entry.key !== "string" || !isFeatureKey(entry.key)) {
                throw new BadRequestError(`Unknown feature key: ${String(entry?.key)}`);
            }
            if (typeof entry.is_enabled !== "boolean") {
                throw new BadRequestError(`is_enabled must be a boolean for '${entry.key}'`);
            }
            deduped.set(entry.key, entry.is_enabled);
        }

        const model = new SchoolFeaturesModel(connection);
        await model.upsertMany(
            schoolId,
            [...deduped.entries()].map(([key, is_enabled]) => ({
                feature_key: key,
                is_enabled: is_enabled ? 1 : 0,
            })),
            updatedBy
        );

        const stored = await model.getBySchoolId(schoolId);
        return {school_id: schoolId, features: buildFeatureState(stored)};
    } finally {
        connection.release();
    }
};
