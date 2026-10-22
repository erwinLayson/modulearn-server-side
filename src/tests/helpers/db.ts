import type { PoolConnection } from "mysql2/promise";
import { databasePool } from "../../config/database.js";

/**
 * Acquires a pooled connection for a test file.
 * Throws a loud, unmistakable error when the database is unreachable so the
 * suite fails instead of silently reporting success.
 */
export async function connectForTest(): Promise<PoolConnection> {
    const pool = databasePool();
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        return connection;
    } catch (err) {
        throw new Error(
            `Database unavailable. Integration tests were NOT executed. ${(err as Error).message}`
        );
    }
}

/** Parameters accepted by `mysql2` execute(), for fixture helpers. */
export type SqlParams = (string | number | Buffer | null)[];
