import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{UserProp} from "../constant/users.js";
import {InternalServerError} from "../helper/error.js";

export default class User {
    constructor(private connection: PoolConnection){}

    async createUser(user: UserProp):Promise<void> {
        const {
            id, email, password, role, school_id, status, name
        } = user;
        try {
            const query = `
                INSERT INTO users(id, email, password, role, school_id, status, name) VALUES(?,?,?,?,?,?,?)
            `;
            const values = [id, email, password, role, school_id, status, name];
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getUserByEmail(email: string):Promise<UserProp | null> {
        try {
            const query = `SELECT * FROM users WHERE email = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [email]);
            if(row.length === 0) return null;
            return row[0] as UserProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getUserByEmailAndSchool(email: string, schoolId: number):Promise<UserProp | null> {
        try {
            const query = `SELECT * FROM users WHERE email = ? AND school_id = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [email, schoolId]);
            if(row.length === 0) return null;
            return row[0] as UserProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSuperAdminByEmail(email: string):Promise<UserProp | null> {
        try {
            const query = `SELECT * FROM users WHERE email = ? AND role = 'super_admin' AND school_id IS NULL LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [email]);
            if(row.length === 0) return null;
            return row[0] as UserProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAllUsers():Promise<UserProp[]> {
        try {
            const query = `SELECT id, email, role, school_id, status, name, created_at FROM users`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query);
            return row as UserProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getUserById(id: Buffer):Promise<UserProp | null> {
        try {
            const query = `SELECT * FROM users WHERE id = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) return null;
            return row[0] as UserProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateUser(id: Buffer, data: Partial<Pick<UserProp, "email" | "role" | "school_id" | "status" | "name">>):Promise<void> {
        const fields: string[] = [];
        const values: (string | number | Buffer | null)[] = [];

        if(data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
        if(data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
        if(data.school_id !== undefined) { fields.push("school_id = ?"); values.push(data.school_id); }
        if(data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
        if(data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }

        if(fields.length === 0) { return; }
        values.push(id);

        try {
            const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteUser(id: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM users WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}