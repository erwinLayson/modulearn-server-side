import {databasePool} from "../config/database.js";
import ModuleModel from "../model/modules.js";
import {NotFoundError} from "../helper/error.js";
import type{ModuleProp} from "../constant/modules.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";

export const registerModuleService = async (module: ModuleProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        await moduleModel.registerModule(module);
        return module.id;
    } catch(err) {
        throw err;
    } finally {
        connection.release();
    }
};

export const getModulesBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        const modules = await moduleModel.getModulesBySchoolId(school_id);
        return modules.map(m => ({
            ...m,
            id: bufferToUUID(m.id),
            admin_id: bufferToUUID(m.admin_id),
            subject_id: m.subject_id ? bufferToUUID(m.subject_id) : null,
        }));
    } finally {
        connection.release();
    }
};

export const getModuleByIdService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const moduleModel = new ModuleModel(connection);
        const module = await moduleModel.getModuleById(UUIDToBuffer(id));
        if(module === null) {
            throw new NotFoundError("Module not found", 404);
        }
        return {
            ...module,
            id: bufferToUUID(module.id),
            admin_id: bufferToUUID(module.admin_id),
            subject_id: module.subject_id ? bufferToUUID(module.subject_id) : null,
        };
    } finally {
        connection.release();
    }
};

export const updateModuleService = async (id: string, data: Partial<Pick<ModuleProp, "title" | "description" | "subject" | "subject_id">>) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const moduleModel = new ModuleModel(connection);
        await moduleModel.updateModule(UUIDToBuffer(id), data);
    } finally {
        connection.release();
    }
};

export const deleteModuleService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const moduleModel = new ModuleModel(connection);
        await moduleModel.deleteModule(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};

export const getAllModulesService = async () => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const moduleModel = new ModuleModel(connection);
        const modules = await moduleModel.getAllModules();
        return modules.map(m => ({
            ...m,
            id: bufferToUUID(m.id),
            admin_id: bufferToUUID(m.admin_id),
            subject_id: m.subject_id ? bufferToUUID(m.subject_id) : null,
        }));
    } finally {
        connection.release();
    }
};