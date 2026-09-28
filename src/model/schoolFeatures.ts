import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";

import {InternalServerError} from "../helper/error.js";

export interface SchoolFeatureRow extends RowDataPacket {
    feature_key: string;
    is_enabled: number;
}

export interface SchoolFeatureEntry {
    feature_key: string;
    is_enabled: number;
}

class SchoolFeatures {
    constructor(private connection: PoolConnection){};

    /** All rows stored for a school. Missing keys mean "enabled" (opt-out model). */
    async getBySchoolId(schoolId: number): Promise<SchoolFeatureEntry[]> {
        try {
            const query = `SELECT feature_key, is_enabled FROM school_features WHERE school_id = ?`;
            const [rows] = await this.connection.execute<SchoolFeatureRow[]>(query, [schoolId]);
            return rows.map(row => ({feature_key: row.feature_key, is_enabled: Number(row.is_enabled)}));
        }catch(err) {
            throw new InternalServerError("Getting school features error", 500, err);
        }
    }

    /** True when the feature has no row (default enabled) or its row is enabled. */
    async isEnabled(schoolId: number, featureKey: string): Promise<boolean> {
        try {
            const query = `SELECT is_enabled FROM school_features WHERE school_id = ? AND feature_key = ? LIMIT 1`;
            const [rows] = await this.connection.execute<SchoolFeatureRow[]>(query, [schoolId, featureKey]);
            const row = rows[0];
            if (!row) return true;
            return Number(row.is_enabled) === 1;
        }catch(err) {
            throw new InternalServerError("Checking school feature error", 500, err);
        }
    }

    async upsertMany(
        schoolId: number,
        entries: SchoolFeatureEntry[],
        updatedBy: Buffer | null
    ): Promise<void> {
        if (entries.length === 0) return;
        try {
            const values = entries.map(entry => [schoolId, entry.feature_key, entry.is_enabled, updatedBy]);
            const query = `
                INSERT INTO school_features (school_id, feature_key, is_enabled, updated_by)
                VALUES ?
                ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)
            `;
            await this.connection.query<ResultSetHeader>(query, [values]);
        }catch(err) {
            throw new InternalServerError("Updating school features error", 500, err);
        }
    }
}

export default SchoolFeatures;
