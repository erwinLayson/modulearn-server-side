import type{PoolConnection, ResultSetHeader, RowDataPacket} from "mysql2/promise";

// Types
import type{ SchoolsProp } from "../constant/schools.js";
import {InternalServerError} from "../helper/error.js"

class Schools {
    constructor(private connection: PoolConnection){};

    // ============ REGISTER NEW SCHOOL ============
    async registerSchool(newSchool: SchoolsProp):Promise<void> {
        const {
            id,
            school_id, 
            school_name,
            school_email,
            school_level,
            academic_system,
            period_count,
            academic_config_completed,
            address,
            region,
            province,
            city,
            contact_number,
            school_logo,
            school_admin,
            admin_id
        } = newSchool;
        try {
             const query = `
                INSERT INTO schools(id, school_id, school_name, school_email, address, school_level, academic_system, period_count, academic_config_completed, region, province, city, contact_number, school_logo, school_admin, admin_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `;
            const values = [id, school_id, school_name, school_email, address, school_level, academic_system, period_count, academic_config_completed, region, province, city, contact_number, school_logo, school_admin, admin_id]
            
            await this.connection.execute<ResultSetHeader>(query, values);

        }catch(err) {
            throw new InternalServerError("Internal Server error ", 500, err);
        }
    }

    async getSchoolsData(admin_id: Buffer):Promise<SchoolsProp | null>{
        try {
            const query = `SELECT * FROM schools WHERE admin_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [admin_id])

            if(row.length === 0) {
                return null
            }

            return row[0] as SchoolsProp;
        }catch(err) {
            throw new InternalServerError('Getting school data server error', 500, err);
        }
    }

    async getAllSchools():Promise<SchoolsProp[]>{
        try {
            const query = `SELECT * FROM schools`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query);
            return row as SchoolsProp[];
        }catch(err) {
            throw new InternalServerError('Getting all schools server error', 500, err);
        }
    }

    async getSchoolBySchoolId(schoolId: number):Promise<SchoolsProp | null>{
        try {
            const query = `SELECT * FROM schools WHERE school_id = ?`;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [schoolId]);
            return (row as SchoolsProp[])[0] || null;
        }catch(err) {
            throw new InternalServerError('Getting school by school_id error', 500, err);
        }
    }

    async updateSchoolConfig(schoolId: number, config: { academic_system?: string; period_count?: number; academic_config_completed?: number }):Promise<void>{
        try {
            const fields: string[] = [];
            const values: (string | number)[] = [];
            if (config.academic_system !== undefined) { fields.push("academic_system = ?"); values.push(config.academic_system); }
            if (config.period_count !== undefined) { fields.push("period_count = ?"); values.push(config.period_count); }
            if (config.academic_config_completed !== undefined) { fields.push("academic_config_completed = ?"); values.push(config.academic_config_completed); }
            if (fields.length === 0) return;
            values.push(schoolId);
            const query = `UPDATE schools SET ${fields.join(", ")} WHERE school_id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        }catch(err) {
            throw new InternalServerError('Updating school config error', 500, err);
        }
    }
}

export default Schools