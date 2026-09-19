import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { InternalServerError } from "../helper/error.js";
import type{FacultyProp} from "../constant/faculties.js";


export default class Faculty {
    constructor(private connection: PoolConnection){}

    // ====================== REGISTER NEW FACULTY ========================
    async registerFaculty(faculty: FacultyProp):Promise<void> {
        const {id, first_name, last_name, email, password, school_id, contact_number, admin_id, faculty_role} = faculty;

        try {
            const query = `
                INSERT INTO faculties(id, first_name, last_name, email, password, school_id, contact_number, admin_id, faculty_role) VALUES(?,?,?,?,?,?,?,?,?)
            `;
            const values = [id, first_name, last_name, email, password, school_id, contact_number, admin_id, faculty_role];
            await this.connection.execute<ResultSetHeader>(query, values);
        }catch(err) {
            throw new InternalServerError("Creating new faculty Internal Server Error", 500, err);
        }
    }


    // ============= GET FACULTY PASSWORD CREDENTIAL ==================
    async getFacultyPassword(email: string):Promise<{id: Buffer, password: string} | null> {
        try {
            const query = `
                SELECT id, password FROM faculties WHERE email = ? LIMIT 1
            `;

            const [row] = await this.connection.execute<RowDataPacket[]>(query, [email]);

            const facultyData = row[0] as { id: Buffer, password: string} ?? null

            return facultyData;
        }catch(err) {
            throw new InternalServerError(`Getting faculty account Internal server error`, 500, err);
        }
    }

    // ====================== GET FACULTIES BY SCHOOL ID ========================
    async getFacultiesBySchoolId(school_id: number):Promise<FacultyProp[]> {
        try {
            const query = `
                SELECT id, first_name, last_name, email, school_id, contact_number, admin_id, faculty_role FROM faculties WHERE school_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as FacultyProp[];
        }catch(err) {
            throw new InternalServerError("Getting faculties Internal Server Error", 500, err);
        }
    }

    // ====================== GET FACULTY BY ID ========================
    async getFacultyById(id: Buffer):Promise<FacultyProp | null> {
        try {
            const query = `
                SELECT id, first_name, last_name, email, school_id, contact_number, admin_id, faculty_role FROM faculties WHERE id = ? LIMIT 1
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) return null;
            return row[0] as FacultyProp;
        }catch(err) {
            throw new InternalServerError("Getting faculty Internal Server Error", 500, err);
        }
    }

    // ====================== UPDATE FACULTY ========================
    async updateFaculty(id: Buffer, data: Partial<Pick<FacultyProp, "first_name" | "last_name" | "email" | "contact_number" | "faculty_role">>):Promise<void> {
        try {
            const fields: string[] = [];
            const values: (string | Buffer)[] = [];

            if(data.first_name !== undefined) {
                fields.push("first_name = ?");
                values.push(data.first_name);
            }
            if(data.last_name !== undefined) {
                fields.push("last_name = ?");
                values.push(data.last_name);
            }
            if(data.email !== undefined) {
                fields.push("email = ?");
                values.push(data.email);
            }
            if(data.contact_number !== undefined) {
                fields.push("contact_number = ?");
                values.push(data.contact_number);
            }
            if(data.faculty_role !== undefined) {
                fields.push("faculty_role = ?");
                values.push(data.faculty_role);
            }

            if(fields.length === 0) return;

            values.push(id);

            const query = `
                UPDATE faculties SET ${fields.join(", ")} WHERE id = ?
            `;

            await this.connection.execute<ResultSetHeader>(query, values);
        }catch(err) {
            throw new InternalServerError("Updating faculty Internal Server Error", 500, err);
        }
    }

    // ====================== DELETE FACULTY ========================
    async deleteFaculty(id: Buffer):Promise<void> {
        try {
            const query = `
                DELETE FROM faculties WHERE id = ?
            `;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        }catch(err) {
            throw new InternalServerError("Deleting faculty Internal Server Error", 500, err);
        }
    }

}
