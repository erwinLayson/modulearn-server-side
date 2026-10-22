import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
    ModuleActivityTemplatePayload,
    ModuleActivityTemplateProp,
    ModuleActivityTemplateUpdatePayload,
} from "../constant/moduleActivityTemplates.js";
import { InternalServerError } from "../helper/error.js";

export default class ModuleActivityTemplate {
    constructor(private connection: PoolConnection) {}

    async createTemplate(
        id: Buffer,
        moduleId: Buffer,
        data: Required<Pick<ModuleActivityTemplatePayload, "title" | "max_score">> &
            Pick<ModuleActivityTemplatePayload, "instructions" | "category" | "sort_order">
    ): Promise<void> {
        try {
            const query = `
                INSERT INTO module_activity_templates
                    (id, module_id, title, instructions, category, max_score, sort_order)
                VALUES (?,?,?,?,?,?,?)
            `;
            await this.connection.execute<ResultSetHeader>(query, [
                id,
                moduleId,
                data.title,
                data.instructions ?? null,
                data.category ?? "activities",
                data.max_score,
                data.sort_order ?? 0,
            ]);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async listByModule(moduleId: Buffer): Promise<ModuleActivityTemplateProp[]> {
        try {
            const query = `
                SELECT id, module_id, title, instructions, category, max_score, sort_order,
                       created_at, updated_at
                FROM module_activity_templates
                WHERE module_id = ?
                ORDER BY sort_order ASC, created_at ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [moduleId]);
            return rows as ModuleActivityTemplateProp[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getById(templateId: Buffer): Promise<ModuleActivityTemplateProp | null> {
        try {
            const query = `
                SELECT id, module_id, title, instructions, category, max_score, sort_order,
                       created_at, updated_at
                FROM module_activity_templates
                WHERE id = ?
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [templateId]);
            return (rows as ModuleActivityTemplateProp[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getByIdForModule(templateId: Buffer, moduleId: Buffer): Promise<ModuleActivityTemplateProp | null> {
        try {
            const query = `
                SELECT id, module_id, title, instructions, category, max_score, sort_order,
                       created_at, updated_at
                FROM module_activity_templates
                WHERE id = ? AND module_id = ?
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [templateId, moduleId]);
            return (rows as ModuleActivityTemplateProp[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateTemplate(
        templateId: Buffer,
        moduleId: Buffer,
        data: ModuleActivityTemplateUpdatePayload
    ): Promise<void> {
        const fields: string[] = [];
        const values: (string | number | Buffer | null)[] = [];

        if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
        if (data.instructions !== undefined) { fields.push("instructions = ?"); values.push(data.instructions); }
        if (data.category !== undefined) { fields.push("category = ?"); values.push(data.category); }
        if (data.max_score !== undefined) { fields.push("max_score = ?"); values.push(data.max_score); }
        if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }

        if (fields.length === 0) { return; }
        values.push(templateId, moduleId);

        try {
            const query = `
                UPDATE module_activity_templates
                SET ${fields.join(", ")}
                WHERE id = ? AND module_id = ?
            `;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteTemplate(templateId: Buffer, moduleId: Buffer): Promise<void> {
        try {
            await this.connection.execute<ResultSetHeader>(
                `DELETE FROM module_activity_templates WHERE id = ? AND module_id = ?`,
                [templateId, moduleId]
            );
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
