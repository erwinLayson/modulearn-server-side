import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{SubjectProp} from "../constant/subjects.js";
import {InternalServerError} from "../helper/error.js";

export default class Subject {
    constructor(private connection: PoolConnection){}

    async registerSubject(subject: SubjectProp):Promise<void> {
        const {id, name, subject_code, description, school_id, admin_id} = subject;
        try {
            const query = `INSERT INTO subjects(id, name, subject_code, description, school_id, admin_id) VALUES(?,?,?,?,?,?)`;
            const values = [id, name, subject_code ?? null, description, school_id, admin_id];
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSubjectsBySchoolId(school_id: number):Promise<SubjectProp[]> {
        try {
            const query = `SELECT id, name, subject_code, description, school_id, admin_id, created_at, updated_at FROM subjects WHERE school_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as SubjectProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getSubjectById(id: Buffer):Promise<SubjectProp | null> {
        try {
            const query = `SELECT id, name, subject_code, description, school_id, admin_id, created_at, updated_at FROM subjects WHERE id = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) { return null }
            return row[0] as SubjectProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateSubject(id: Buffer, data: Partial<Pick<SubjectProp, "name" | "subject_code" | "description">>):Promise<void> {
        const fields: string[] = [];
        const values: (string | Buffer | null)[] = [];

        if(data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
        if(data.subject_code !== undefined) { fields.push("subject_code = ?"); values.push(data.subject_code); }
        if(data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }

        if(fields.length === 0) { return; }
        values.push(id);

        try {
            const query = `UPDATE subjects SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteSubject(id: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM subjects WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAllSubjects():Promise<SubjectProp[]> {
        try {
            const query = `SELECT id, name, subject_code, description, school_id, admin_id, created_at, updated_at FROM subjects`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query);
            return row as SubjectProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async assignFaculty(subjectId: Buffer, facultyId: Buffer):Promise<void> {
        try {
            const query = `INSERT INTO subject_faculties(subject_id, faculty_id) VALUES(?,?)`;
            await this.connection.execute<ResultSetHeader>(query, [subjectId, facultyId]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async removeFaculty(subjectId: Buffer, facultyId: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM subject_faculties WHERE subject_id = ? AND faculty_id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [subjectId, facultyId]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getFacultiesBySubjectId(subjectId: Buffer):Promise<{id: Buffer; first_name: string; last_name: string; email: string}[]> {
        try {
            const query = `
                SELECT f.id, f.first_name, f.last_name, f.email
                FROM faculties f
                INNER JOIN subject_faculties sf ON sf.faculty_id = f.id
                WHERE sf.subject_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [subjectId]);
            return row as {id: Buffer; first_name: string; last_name: string; email: string}[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getFacultiesBySchoolId(school_id: number):Promise<{id: Buffer; first_name: string; last_name: string; email: string}[]> {
        try {
            const query = `SELECT id, first_name, last_name, email FROM faculties WHERE school_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as {id: Buffer; first_name: string; last_name: string; email: string}[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
