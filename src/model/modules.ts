import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
    ModuleAssignmentRow,
    ModuleListFilters,
    ModuleListRow,
    ModuleProp,
    ModuleStatus,
} from "../constant/modules.js";
import { InternalServerError } from "../helper/error.js";

export default class Module {
    constructor(private connection: PoolConnection) {}

    async registerModule(module: ModuleProp): Promise<void> {
        const {
            id, title, description, subject, subject_id, school_id, admin_id,
            owner_faculty_id, status, lesson_content,
        } = module;
        try {
            const query = `
                INSERT INTO modules
                    (id, title, description, subject, subject_id, school_id, admin_id,
                     owner_faculty_id, status, lesson_content)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            `;
            const values = [
                id, title, description, subject, subject_id, school_id, admin_id,
                owner_faculty_id, status, lesson_content,
            ];
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getModulesBySchoolId(school_id: number): Promise<ModuleProp[]> {
        try {
            const query = `
                SELECT id, title, description, subject, subject_id, school_id, admin_id,
                       owner_faculty_id, status, lesson_content, created_at, updated_at
                FROM modules
                WHERE school_id = ?
                ORDER BY created_at DESC
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [school_id]);
            return row as ModuleProp[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getModuleById(id: Buffer): Promise<ModuleProp | null> {
        try {
            const query = `
                SELECT id, title, description, subject, subject_id, school_id, admin_id,
                       owner_faculty_id, status, lesson_content, created_at, updated_at
                FROM modules
                WHERE id = ?
                LIMIT 1
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query, [id]);
            if (row.length === 0) { return null; }
            return row[0] as ModuleProp;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async listModulesByOwner(ownerId: Buffer, filters: ModuleListFilters): Promise<ModuleListRow[]> {
        const fields: string[] = [];
        const values: (Buffer | string)[] = [ownerId];

        if (filters.q) {
            fields.push("(m.title LIKE ? OR m.description LIKE ?)");
            const like = `%${filters.q}%`;
            values.push(like, like);
        }
        if (filters.status) {
            fields.push("m.status = ?");
            values.push(filters.status);
        }
        if (filters.subject_id) {
            fields.push("m.subject_id = ?");
            values.push(filters.subject_id);
        }

        const where = fields.length > 0 ? ` AND ${fields.join(" AND ")}` : "";
        const query = `
            SELECT m.id, m.title, m.description, m.subject, m.subject_id, m.school_id,
                   m.admin_id, m.owner_faculty_id, m.status, m.lesson_content,
                   m.created_at, m.updated_at,
                   (SELECT COUNT(*) FROM module_activity_templates t WHERE t.module_id = m.id) AS template_count,
                   (SELECT COUNT(*) FROM class_modules cm WHERE cm.module_id = m.id) AS assignment_count
            FROM modules m
            WHERE m.owner_faculty_id = ?${where}
            ORDER BY m.updated_at DESC, m.created_at DESC
        `;

        try {
            const [row] = await this.connection.execute<RowDataPacket[]>(query, values);
            return row as ModuleListRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateModule(
        id: Buffer,
        data: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id" | "lesson_content" | "status">>
    ): Promise<void> {
        const fields: string[] = [];
        const values: (string | Buffer | null)[] = [];

        if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
        if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
        if (data.subject !== undefined) { fields.push("subject = ?"); values.push(data.subject); }
        if (data.subject_id !== undefined) { fields.push("subject_id = ?"); values.push(data.subject_id); }
        if (data.lesson_content !== undefined) { fields.push("lesson_content = ?"); values.push(data.lesson_content); }
        if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

        if (fields.length === 0) { return; }
        values.push(id);

        try {
            const query = `UPDATE modules SET ${fields.join(", ")} WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateTeacherModule(
        id: Buffer,
        ownerId: Buffer,
        data: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id" | "lesson_content" | "status">>
    ): Promise<void> {
        const fields: string[] = [];
        const values: (string | Buffer | null)[] = [];

        if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
        if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
        if (data.subject !== undefined) { fields.push("subject = ?"); values.push(data.subject); }
        if (data.subject_id !== undefined) { fields.push("subject_id = ?"); values.push(data.subject_id); }
        if (data.lesson_content !== undefined) { fields.push("lesson_content = ?"); values.push(data.lesson_content); }
        if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

        if (fields.length === 0) { return; }
        values.push(id, ownerId);

        try {
            const query = `UPDATE modules SET ${fields.join(", ")} WHERE id = ? AND owner_faculty_id = ?`;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteModule(id: Buffer): Promise<void> {
        try {
            const query = `DELETE FROM modules WHERE id = ?`;
            await this.connection.execute<ResultSetHeader>(query, [id]);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getAllModules(): Promise<ModuleProp[]> {
        try {
            const query = `
                SELECT id, title, description, subject, subject_id, school_id, admin_id,
                       owner_faculty_id, status, lesson_content, created_at, updated_at
                FROM modules
                ORDER BY created_at DESC
            `;
            const [row] = await this.connection.execute<RowDataPacket[]>(query);
            return row as ModuleProp[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getModuleAssignmentCount(moduleId: Buffer): Promise<number> {
        try {
            const [rows] = await this.connection.execute<RowDataPacket[]>(
                `SELECT COUNT(*) AS cnt FROM class_modules WHERE module_id = ?`,
                [moduleId]
            );
            return Number(rows[0]?.cnt ?? 0);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getModuleAssignments(moduleId: Buffer): Promise<ModuleAssignmentRow[]> {
        try {
            const query = `
                SELECT cm.id, cm.module_id, cm.classroom_id, c.class_name,
                       cm.school_year_id, sy.name AS school_year_name, cm.assigned_at
                FROM class_modules cm
                INNER JOIN classes c ON c.id = cm.classroom_id
                INNER JOIN school_years sy ON sy.id = cm.school_year_id
                WHERE cm.module_id = ?
                ORDER BY sy.start_date DESC, c.class_name ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [moduleId]);
            return rows as ModuleAssignmentRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async setModuleStatus(id: Buffer, ownerId: Buffer, status: ModuleStatus): Promise<void> {
        try {
            await this.connection.execute<ResultSetHeader>(
                `UPDATE modules SET status = ? WHERE id = ? AND owner_faculty_id = ?`,
                [status, id, ownerId]
            );
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
