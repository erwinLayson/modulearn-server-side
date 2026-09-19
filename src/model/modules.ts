import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{ModuleProp} from "../constant/modules.js";
import {InternalServerError} from "../helper/error.js";

export default class Module {
    constructor(private connection: PoolConnection){}

    async registerModule(module: ModuleProp):Promise<void> {
        const {id, title, description, subject, subject_id, school_id, admin_id} = module;
        try {
            const query = `INSERT INTO modules(id, title, description, subject, subject_id, school_id, admin_id) VALUES(?,?,?,?,?,?,?)`;
            const values = [id, title, description, subject, subject_id, school_id, admin_id];
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getModulesBySchoolId(school_id: number):Promise<ModuleProp[]> {
        try {
            const query = `SELECT id, title, description, subject, subject_id, school_id, admin_id FROM modules WHERE school_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as ModuleProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getModuleById(id: Buffer):Promise<ModuleProp | null> {
        try {
            const query = `SELECT id, title, description, subject, subject_id, school_id, admin_id FROM modules WHERE id = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) { return null }
            return row[0] as ModuleProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateModule(id: Buffer, data: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id">>):Promise<void> {
        const fields: string[] = [];
        const values: (string | Buffer | null)[] = [];

        if(data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
        if(data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
        if(data.subject !== undefined) { fields.push("subject = ?"); values.push(data.subject); }
        if(data.subject_id !== undefined) { fields.push("subject_id = ?"); values.push(data.subject_id); }

        if(fields.length === 0) { return; }
        values.push(id);

        try {
            const query = `UPDATE modules SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteModule(id: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM modules WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAllModules():Promise<ModuleProp[]> {
        try {
            const query = `SELECT id, title, description, subject, subject_id, school_id, admin_id FROM modules`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query);
            return row as ModuleProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}