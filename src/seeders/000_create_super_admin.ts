import {databasePool} from "../config/database.js";
import {hashPassword} from "../helper/hashPassword.js";
import {generateRandomUUID} from "../helper/generateRandomId.js";

async function seedSuperAdmin() {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const email = "superadmin@modulearn.com";
        const password = "password123";

        const existing = await connection.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if ((existing[0] as any[]).length > 0) {
            console.log("Super admin already exists");
            return;
        }

        const id = generateRandomUUID();
        const hashedPassword = await hashPassword(password);

        await connection.query(
            `INSERT INTO users (id, email, password, role, status, school_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, email, hashedPassword, "super_admin", "active", null]
        );

        console.log("Super admin created successfully");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    } catch (err) {
        console.error("Failed to create super admin:", err);
        throw err;
    } finally {
        connection.release();
        await pool.end();
    }
}

seedSuperAdmin();