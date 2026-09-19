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
                INSERT INTO schools(id, school_id, school_name, school_email, address, school_level, region, province, city, contact_number, school_logo, school_admin, admin_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            `;
            const values = [id, school_id, school_name, school_email, address, school_level, region, province, city, contact_number, school_logo, school_admin, admin_id]
            
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
}

export default Schools