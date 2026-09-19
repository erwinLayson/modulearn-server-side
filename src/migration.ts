import {getEnvName} from "./helper/getEnv.js"
import type{ResultSetHeader} from "mysql2/promise"

import dotenv from "dotenv";
dotenv.config({
    path: '.env'
});

const system_status = getEnvName("SYSTEM_STATUS") === 'production'; 

dotenv.config({
    path: system_status ? ".env.production" : ".env.development"
});

import path from "node:path";
import fs from "fs/promises";
import {fileURLToPath} from "node:url"
import {databasePool} from "./config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationDirectory = path.join(__dirname, "/migrations")

async function migrate():Promise<void> {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const migrationTableQuery = `
            CREATE TABLE IF NOT EXISTS migrations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `
        console.log("runnig the migration table")
        await connection.query<ResultSetHeader>(migrationTableQuery);

        const migrationsData = `
            SELECT filename FROM migrations ORDER BY id;
        `;

        const [result] = await connection.query(migrationsData);

        const executedFiles = new Set(
            (result as {filename: string}[]).map(row => row.filename.split('.sql')[0])
        );

        const files = (await fs.readdir(migrationDirectory)).filter(file => file.endsWith(".sql")).sort();

        for(const file of files) {
            if(executedFiles.has(file.split('.sql')[0])) {
                console.log(`Skipping file ${file}`);
                continue;
            };


            console.log(`Running file ${file}`);

            const query = await fs.readFile(
                path.join(migrationDirectory, file),
                "utf8"
            );

            await connection.beginTransaction();

            const insertQuery = `
                INSERT INTO migrations(filename) VALUES(?)
            `;

            const filename = file.split(".sql")[0];

            try {
                // Split multi-statement SQL files and execute each statement individually
                const statements = query
                    .split(";")
                    .map(s => s.replace(/--.*$/gm, "").trim())
                    .filter(s => s.length > 0);

                for (const stmt of statements) {
                    await connection.query(stmt);
                }

                //  ================ insert the filename into migration table ==========
                await connection.query(insertQuery, filename)
                await connection.commit();
                console.log(`${file} migration completed`);
            }catch(err) {
                await connection.rollback();
                throw err;
            }
        }

        console.log("all migrations completed")
    }catch(err) {
        await connection.rollback()
        throw err;
    }finally {
        connection.release();
        await pool.end();
    }
}

migrate();