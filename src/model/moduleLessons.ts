import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
    ModuleLessonInsertProp,
    ModuleLessonRow,
    ModuleLessonUpdateProp,
} from "../constant/moduleLessons.js";
import { InternalServerError } from "../helper/error.js";

export default class ModuleLessonModel {
    constructor(private connection: PoolConnection) {}

    async createLesson(data: ModuleLessonInsertProp): Promise<void> {
        try {
            const query = `
                INSERT INTO module_lessons
                    (id, module_id, title, lesson_type, content, file_name, file_path, file_type, file_size, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await this.connection.execute<ResultSetHeader>(query, [
                data.id,
                data.module_id,
                data.title,
                data.lesson_type,
                data.content ?? null,
                data.file_name ?? null,
                data.file_path ?? null,
                data.file_type ?? null,
                data.file_size ?? null,
                data.sort_order ?? 0,
            ]);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async listByModule(moduleId: Buffer): Promise<ModuleLessonRow[]> {
        try {
            const query = `
                SELECT id, module_id, title, lesson_type, content, file_name, file_path,
                       file_type, file_size, sort_order, created_at, updated_at
                FROM module_lessons
                WHERE module_id = ?
                ORDER BY sort_order ASC, created_at ASC
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [moduleId]);
            return rows as ModuleLessonRow[];
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async getByIdForModule(lessonId: Buffer, moduleId: Buffer): Promise<ModuleLessonRow | null> {
        try {
            const query = `
                SELECT id, module_id, title, lesson_type, content, file_name, file_path,
                       file_type, file_size, sort_order, created_at, updated_at
                FROM module_lessons
                WHERE id = ? AND module_id = ?
                LIMIT 1
            `;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [lessonId, moduleId]);
            return (rows as ModuleLessonRow[])[0] ?? null;
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async updateLesson(
        lessonId: Buffer,
        moduleId: Buffer,
        data: ModuleLessonUpdateProp
    ): Promise<void> {
        const fields: string[] = [];
        const values: (string | number | Buffer | null)[] = [];

        if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
        if (data.lesson_type !== undefined) { fields.push("lesson_type = ?"); values.push(data.lesson_type); }
        if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
        if (data.file_name !== undefined) { fields.push("file_name = ?"); values.push(data.file_name); }
        if (data.file_path !== undefined) { fields.push("file_path = ?"); values.push(data.file_path); }
        if (data.file_type !== undefined) { fields.push("file_type = ?"); values.push(data.file_type); }
        if (data.file_size !== undefined) { fields.push("file_size = ?"); values.push(data.file_size); }
        if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }

        if (fields.length === 0) { return; }
        values.push(lessonId, moduleId);

        try {
            const query = `
                UPDATE module_lessons
                SET ${fields.join(", ")}
                WHERE id = ? AND module_id = ?
            `;
            await this.connection.execute<ResultSetHeader>(query, values);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async deleteLesson(lessonId: Buffer, moduleId: Buffer): Promise<void> {
        try {
            await this.connection.execute<ResultSetHeader>(
                `DELETE FROM module_lessons WHERE id = ? AND module_id = ?`,
                [lessonId, moduleId]
            );
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }

    async countByModule(moduleId: Buffer): Promise<number> {
        try {
            const query = `SELECT COUNT(*) AS total FROM module_lessons WHERE module_id = ?`;
            const [rows] = await this.connection.execute<RowDataPacket[]>(query, [moduleId]);
            return Number(rows[0]?.total ?? 0);
        } catch (err) {
            throw new InternalServerError("Internal Server error", 500, err);
        }
    }
}
