import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import type{SchoolYearProp} from "../constant/school-years.js";
import {InternalServerError} from "../helper/error.js";

export default class SchoolYear {
    constructor(private connection: PoolConnection){}

    async create(sy: SchoolYearProp):Promise<void> {
        try {
            const query = `INSERT INTO school_years(name, start_date, end_date, school_id, is_current) VALUES(?,?,?,?,?)`;
            await this.connection.execute<ResultSetHeader>(query, [sy.name, sy.start_date, sy.end_date, sy.school_id, sy.is_current]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getBySchoolId(school_id: number):Promise<SchoolYearProp[]> {
        try {
            const query = `SELECT id, name, start_date, end_date, school_id, is_current, created_at FROM school_years WHERE school_id = ? ORDER BY start_date DESC`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as SchoolYearProp[];
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getCurrentBySchoolId(school_id: number):Promise<SchoolYearProp | null> {
        try {
            const query = `SELECT id, name, start_date, end_date, school_id, is_current FROM school_years WHERE school_id = ? AND is_current = 1 LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            if(row.length === 0) { return null }
            return row[0] as SchoolYearProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getById(id: number):Promise<SchoolYearProp | null> {
        try {
            const query = `SELECT id, name, start_date, end_date, school_id, is_current FROM school_years WHERE id = ? LIMIT 1`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if(row.length === 0) { return null }
            return row[0] as SchoolYearProp;
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async setCurrent(school_id: number, id: number):Promise<void> {
        try {
            await this.connection.execute(`UPDATE school_years SET is_current = 0 WHERE school_id = ?`, [school_id]);
            await this.connection.execute(`UPDATE school_years SET is_current = 1 WHERE id = ?`, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async delete(id: number):Promise<void> {
        try {
            const query = `DELETE FROM school_years WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch(err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
