import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{ClassProp, ClassWithDetails} from "../constant/classes.js";
import {InternalServerError} from "../helper/error.js";

export default class Class {
    constructor(private connection: PoolConnection){}

    async registerClass(cls: ClassProp):Promise<void> {
        const {id, class_name, school_id, faculty_id, capacity, section, grade_level, schedule} = cls;
        try {
            const query = `INSERT INTO classes(id, class_name, school_id, faculty_id, capacity, section, grade_level, schedule) VALUES(?,?,?,?,?,?,?,?)`;
            const values = [id, class_name, school_id, faculty_id, capacity, section, grade_level, schedule ? JSON.stringify(schedule) : null];
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassesBySchoolId(school_id: number):Promise<ClassProp[]> {
        try {
            const query = `SELECT id, class_name, school_id, faculty_id, capacity, section, grade_level, schedule FROM classes WHERE school_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as ClassProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassesBySchoolIdWithDetails(school_id: number):Promise<ClassWithDetails[]> {
        try {
            const query = `
                SELECT 
                    c.id, c.class_name, c.school_id, c.faculty_id, 
                    c.capacity, c.section, c.grade_level, c.schedule, c.created_at,
                    CONCAT(f.first_name, ' ', f.last_name) as faculty_name
                FROM classes c
                LEFT JOIN faculties f ON c.faculty_id = f.id
                WHERE c.school_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as ClassWithDetails[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassesByFacultyId(faculty_id: Buffer):Promise<ClassProp[]> {
        try {
            const query = `SELECT id, class_name, school_id, faculty_id, capacity, section, grade_level, schedule FROM classes WHERE faculty_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [faculty_id]);
            return row as ClassProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassesByFacultyIdWithDetails(faculty_id: Buffer):Promise<(ClassWithDetails & { adviser_role: number; subject_id: Buffer | null; subject_name: string | null; created_at: any })[]> {
        try {
            const query = `
                SELECT DISTINCT
                    c.id, c.class_name, c.school_id, c.faculty_id,
                    c.capacity, c.section, c.grade_level, c.schedule, c.created_at,
                    CONCAT(af.first_name, ' ', af.last_name) as faculty_name,
                    (c.faculty_id = ?) as adviser_role,
                    cf.subject_id,
                    sub.name as subject_name
                FROM classes c
                LEFT JOIN faculties af ON c.faculty_id = af.id
                LEFT JOIN class_faculties cf ON cf.class_id = c.id AND cf.faculty_id = ?
                LEFT JOIN subjects sub ON cf.subject_id = sub.id
                WHERE c.faculty_id = ? OR cf.faculty_id IS NOT NULL
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [faculty_id, faculty_id, faculty_id]);
            return row as (ClassWithDetails & { adviser_role: number; subject_id: Buffer | null; subject_name: string | null; created_at: any })[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAllClasses():Promise<ClassWithDetails[]> {
        try {
            const query = `
                SELECT 
                    c.id, c.class_name, c.school_id, c.faculty_id, 
                    c.capacity, c.section, c.grade_level, c.schedule, c.created_at,
                    CONCAT(f.first_name, ' ', f.last_name) as faculty_name,
                    s.school_name
                FROM classes c
                LEFT JOIN faculties f ON c.faculty_id = f.id
                LEFT JOIN schools s ON c.school_id = s.school_id
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query);
            return row as ClassWithDetails[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getClassById(id: Buffer):Promise<(ClassProp & { faculty_name: string | null }) | null> {
        try {
            const query = `
                SELECT c.id, c.class_name, c.school_id, c.faculty_id, c.capacity, c.section, c.grade_level, c.schedule, c.created_at,
                       CONCAT(f.first_name, ' ', f.last_name) as faculty_name
                FROM classes c
                LEFT JOIN faculties f ON c.faculty_id = f.id
                WHERE c.id = ? LIMIT 1
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) { return null }
            return row[0] as ClassProp & { faculty_name: string | null };
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateClass(id: Buffer, data: Partial<Pick<ClassProp, "class_name" | "faculty_id" | "capacity" | "section" | "grade_level" | "schedule">>):Promise<void> {
        const fields: string[] = [];
        const values: (string | number | Buffer | null)[] = [];

        if(data.class_name !== undefined) { fields.push("class_name = ?"); values.push(data.class_name); }
        if(data.faculty_id !== undefined) { fields.push("faculty_id = ?"); values.push(data.faculty_id); }
        if(data.capacity !== undefined) { fields.push("capacity = ?"); values.push(data.capacity); }
        if(data.section !== undefined) { fields.push("section = ?"); values.push(data.section); }
        if(data.grade_level !== undefined) { fields.push("grade_level = ?"); values.push(data.grade_level); }
        if(data.schedule !== undefined) { fields.push("schedule = ?"); values.push(data.schedule ? JSON.stringify(data.schedule) : null); }

        if(fields.length === 0) { return; }
        values.push(id);

        try {
            const query = `UPDATE classes SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteClass(id: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM classes WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async assignFaculty(classId: Buffer, facultyId: Buffer, subjectId: Buffer | null):Promise<void> {
        try {
            const query = `INSERT INTO class_faculties(class_id, faculty_id, subject_id) VALUES(?,?,?)`;
            await this.connection.execute<ResultSetHeader>(query, [classId, facultyId, subjectId]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async removeFaculty(classId: Buffer, facultyId: Buffer):Promise<void> {
        try {
            const query = `DELETE FROM class_faculties WHERE class_id = ? AND faculty_id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [classId, facultyId]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getFacultiesByClassId(classId: Buffer):Promise<{id: Buffer; first_name: string; last_name: string; email: string; subject_id: Buffer | null; subject_name: string | null}[]> {
        try {
            const query = `
                SELECT f.id, f.first_name, f.last_name, f.email, cf.subject_id, s.name as subject_name
                FROM faculties f
                INNER JOIN class_faculties cf ON cf.faculty_id = f.id
                LEFT JOIN subjects s ON cf.subject_id = s.id
                WHERE cf.class_id = ?
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [classId]);
            return row as {id: Buffer; first_name: string; last_name: string; email: string; subject_id: Buffer | null; subject_name: string | null}[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async replaceFaculty(classId: Buffer, oldFacultyId: Buffer, newFacultyId: Buffer, subjectId: Buffer | null):Promise<void> {
        try {
            const query = `DELETE FROM class_faculties WHERE class_id = ? AND faculty_id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [classId, oldFacultyId]);
            const insertQuery = `INSERT INTO class_faculties(class_id, faculty_id, subject_id) VALUES(?,?,?)`;
            await this.connection.execute<ResultSetHeader>(insertQuery, [classId, newFacultyId, subjectId]);
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

    async getAvailableAdvisers(school_id: number):Promise<{id: Buffer; first_name: string; last_name: string; email: string}[]> {
        try {
            const query = `
                SELECT f.id, f.first_name, f.last_name, f.email
                FROM faculties f
                WHERE f.school_id = ?
                AND f.id NOT IN (SELECT c.faculty_id FROM classes c WHERE c.school_id = ?)
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id, school_id]);
            return row as {id: Buffer; first_name: string; last_name: string; email: string}[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
