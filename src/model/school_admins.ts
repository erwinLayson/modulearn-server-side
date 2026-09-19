import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { InternalServerError } from "../helper/error.js";
import type{SchoolAdminProp, LoginCredentialsProp} from "../constant/schoolAdmins.js";


export default class SchoolAdmin {
    constructor(private connection: PoolConnection){}

    // ====================== REGISTER NEW ADMIN ========================
    async registerNewSchoolAdmin(schoolAdmin: SchoolAdminProp):Promise<void> {
        const {id, email, school_id, password} = schoolAdmin;

        try {
            const query = `
                INSERT INTO school_admins(id, email, school_id, password) VALUES(?,?,?,?)
            `;
            const values = [id, email, school_id, password];
            await this.connection.execute<ResultSetHeader>(query, values);
        }catch(err) {
            throw new InternalServerError("Creating new school admin Internal Server Error", 500, err);
        }
    }


    // ============= GET ADMIN PASSWORD CREDENTIAL ==================
    async getAdminPassword(email: string):Promise<{id: Buffer, password: string} | null> {
        try {
            const query = `
                SELECT id, password FROM school_admins WHERE email = ? OR school_id = ? LIMIT 1
            `;

            const [row] = await this.connection.execute<RowDataPacket[]>(query, [email, email]);

            const admindData = row[0] as { id: Buffer, password: string} ?? null

            return admindData;
        }catch(err) {
            throw new InternalServerError(`Getting admin account Internal server error`, 500, err);
        }
    }

}