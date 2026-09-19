import {databasePool} from "../config/database.js";
import SchoolYearModel from "../model/school-years.js";
import type{SchoolYearProp} from "../constant/school-years.js";

export const createSchoolYearService = async (sy: SchoolYearProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        await model.create(sy);
    } finally {
        connection.release();
    }
};

export const getSchoolYearsBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        return await model.getBySchoolId(school_id);
    } finally {
        connection.release();
    }
};

export const getCurrentSchoolYearService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        return await model.getCurrentBySchoolId(school_id);
    } finally {
        connection.release();
    }
};

export const getSchoolYearByIdService = async (id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        return await model.getById(id);
    } finally {
        connection.release();
    }
};

export const setCurrentSchoolYearService = async (school_id: number, id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        await model.setCurrent(school_id, id);
    } finally {
        connection.release();
    }
};

export const deleteSchoolYearService = async (id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        await model.delete(id);
    } finally {
        connection.release();
    }
};

export const autoGenerateSchoolYearsService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();
    try {
        const model = new SchoolYearModel(connection);
        const existing = await model.getCurrentBySchoolId(school_id);
        if (existing) return existing;

        const now = new Date();
        const currentYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
        const nextYear = currentYear + 1;

        const currentSY: SchoolYearProp = {
            id: 0,
            name: `${currentYear}-${nextYear}`,
            start_date: `${currentYear}-06-01`,
            end_date: `${nextYear}-05-31`,
            school_id,
            is_current: 1,
        };
        await model.create(currentSY);

        const nextSY: SchoolYearProp = {
            id: 0,
            name: `${nextYear}-${nextYear + 1}`,
            start_date: `${nextYear}-06-01`,
            end_date: `${nextYear + 1}-05-31`,
            school_id,
            is_current: 0,
        };
        await model.create(nextSY);

        return await model.getCurrentBySchoolId(school_id);
    } finally {
        connection.release();
    }
};
