import mysql2 from "mysql2/promise";
import { getEnvName } from "../helper/getEnv.js";

// ============ SINGLETON POOL ============
// Created lazily on first use so env vars are already loaded,
// and reused for the entire process lifetime.
let pool: mysql2.Pool | undefined;

const databasePool = (): mysql2.Pool => {
    pool ??= mysql2.createPool({
        host: getEnvName("HOST"),
        user: getEnvName("USER"),
        database: getEnvName("DB_NAME"),
        password: getEnvName("DB_PASSWORD"),
        port: Number(getEnvName("DB_PORT")),

        ...(getEnvName("SYSTEM_STATUS") === 'production' && {
            ssl:  {
                rejectUnauthorized: true
            }
        })
    });

    return pool;
}

const checkDBConnection = async (): Promise<void> => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        await connection.ping();
        console.log(`Database connection successfull`)
    } finally {
        connection.release();
    }
};

export {
    checkDBConnection, 
    databasePool
}