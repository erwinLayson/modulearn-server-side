import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{StudentProp, StudentImportRow} from "../constant/students.js";
import {InternalServerError} from "../helper/error.js";

export default class Student {
    constructor(private connection: PoolConnection){}

    async registerStudent(student: StudentProp):Promise<void> {
        const {
            id, first_name, middle_name, last_name, extension_name, email,
            school_id, lrn, date_of_birth, place_of_birth, sex, nationality,
            contact_number, region, province, city_municipality, barangay, purok_street, admin_id
        } = student;
        try {
            const query = `
                INSERT INTO students(
                    id, first_name, middle_name, last_name, extension_name, email,
                    school_id, lrn, date_of_birth, place_of_birth, sex, nationality,
                    contact_number, region, province, city_municipality, barangay, purok_street, admin_id
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `;
            const values = [
                id, first_name, middle_name, last_name, extension_name, email,
                school_id, lrn, date_of_birth, place_of_birth, sex, nationality,
                contact_number, region, province, city_municipality, barangay, purok_street, admin_id
            ];
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    /**
     * Inserts one student row. Assumes a matching users row already exists
     * (students.id has a FK to users.id) and that the transaction is managed by the caller.
     */
    async insertStudentRow(student: StudentProp): Promise<void> {
        await this.registerStudent(student);
    }

    async getStudentPassword(email: string):Promise<{id: Buffer, password: string, school_id: number, first_name: string, last_name: string, admin_id: Buffer} | null> {
        try {
            const query = `SELECT id, password, school_id, first_name, last_name, admin_id FROM students WHERE email = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [email]);
            if (!row[0]) return null;
            const studentData = row[0] as {id: Buffer, password: string, school_id: number, first_name: string, last_name: string, admin_id: Buffer};
            return studentData;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getStudentsBySchoolId(school_id: number):Promise<StudentProp[]> {
        try {
            const query = `
                SELECT 
                    id, first_name, middle_name, last_name, extension_name, email,
                    school_id, lrn, date_of_birth, place_of_birth, sex, nationality,
                    contact_number, region, province, city_municipality, barangay, purok_street, admin_id,
                    TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age
                FROM students WHERE school_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as StudentProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getStudentById(id: Buffer):Promise<StudentProp | null> {
        try {
            const query = `
                SELECT 
                    id, first_name, middle_name, last_name, extension_name, email,
                    school_id, lrn, date_of_birth, place_of_birth, sex, nationality,
                    contact_number, region, province, city_municipality, barangay, purok_street, admin_id,
                    TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age
                FROM students WHERE id = ? LIMIT 1
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) { return null }
            return row[0] as StudentProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateStudent(id: Buffer, data: Partial<Pick<StudentProp,
        "first_name" | "middle_name" | "last_name" | "extension_name" | "email" |
        "lrn" | "date_of_birth" | "place_of_birth" | "sex" | "nationality" |
        "contact_number" | "region" | "province" | "city_municipality" | "barangay" | "purok_street"
    >>):Promise<void> {
        const fields: string[] = [];
        const values: (string | number | Buffer | null)[] = [];

        if(data.first_name !== undefined) { fields.push("first_name = ?"); values.push(data.first_name); }
        if(data.middle_name !== undefined) { fields.push("middle_name = ?"); values.push(data.middle_name); }
        if(data.last_name !== undefined) { fields.push("last_name = ?"); values.push(data.last_name); }
        if(data.extension_name !== undefined) { fields.push("extension_name = ?"); values.push(data.extension_name); }
        if(data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
        if(data.lrn !== undefined) { fields.push("lrn = ?"); values.push(data.lrn); }
        if(data.date_of_birth !== undefined) { fields.push("date_of_birth = ?"); values.push(data.date_of_birth); }
        if(data.place_of_birth !== undefined) { fields.push("place_of_birth = ?"); values.push(data.place_of_birth); }
        if(data.sex !== undefined) { fields.push("sex = ?"); values.push(data.sex); }
        if(data.nationality !== undefined) { fields.push("nationality = ?"); values.push(data.nationality); }
        if(data.contact_number !== undefined) { fields.push("contact_number = ?"); values.push(data.contact_number); }
        if(data.region !== undefined) { fields.push("region = ?"); values.push(data.region); }
        if(data.province !== undefined) { fields.push("province = ?"); values.push(data.province); }
        if(data.city_municipality !== undefined) { fields.push("city_municipality = ?"); values.push(data.city_municipality); }
        if(data.barangay !== undefined) { fields.push("barangay = ?"); values.push(data.barangay); }
        if(data.purok_street !== undefined) { fields.push("purok_street = ?"); values.push(data.purok_street); }

        if(fields.length === 0) { return; }
        values.push(id);

        try {
            const query = `UPDATE students SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteStudent(id: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM students WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}