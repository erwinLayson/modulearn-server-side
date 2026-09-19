import bcrypt from "bcrypt";
import {databasePool} from "../config/database.js";
import StudentModel from "../model/students.js";
import UserModel from "../model/users.js";
import {NotFoundError, BadRequestError, UnauthorizedError} from "../helper/error.js";
import {generateToken} from "../helper/jwt.js";
import type{StudentProp, StudentImportRow} from "../constant/students.js";
import { bufferToUUID } from "../helper/bufferToUUID.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { hashPassword } from "../helper/hashPassword.js";
import { getEnvName } from "../helper/getEnv.js";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

// Column name normalization map - handles various formats
// All aliases are stored in normalized form (lowercase, spaces/hyphens/underscores -> single underscore)
const COLUMN_ALIASES: Record<string, string[]> = {
    first_name: ["first_name", "firstname", "first name", "fname", "first", "given_name", "given name", "givenname"],
    middle_name: ["middle_name", "middlename", "middle name", "mname", "middle", "mi"],
    last_name: ["last_name", "lastname", "last name", "lname", "last", "surname", "family_name", "family name", "familyname"],
    extension_name: ["extension_name", "extensionname", "extension name", "ext_name", "ext", "suffix", "name_extension", "nameextension"],
    email: ["email", "e_mail", "email_address", "email address", "mail"],
    grade_level: ["grade_level", "gradelevel", "grade level", "grade", "year_level", "year level", "yr_level", "year", "yearlevel"],
    lrn: ["lrn", "learner_reference_number", "learner reference number", "student_id", "student id", "id_number", "id number", "studentid", "idnumber"],
    date_of_birth: ["date_of_birth", "dateofbirth", "date of birth", "dob", "birthdate", "birth_date", "birth date", "birthdate", "dobirth"],
    place_of_birth: ["place_of_birth", "placeofbirth", "place of birth", "birthplace", "birth_place", "birth place", "pob"],
    sex: ["sex", "gender"],
    nationality: ["nationality", "citizenship", "citizen"],
    contact_number: ["contact_number", "contactnumber", "contact number", "phone", "phone_number", "phone number", "mobile", "mobile_number", "mobile number", "tel", "telephone"],
    region: ["region", "reg"],
    province: ["province", "prov"],
    city_municipality: ["city_municipality", "citymunicipality", "city municipality", "city", "municipality", "town"],
    barangay: ["barangay", "brgy", "barrio", "village"],
    purok_street: ["purok_street", "purokstreet", "purok street", "purok", "street", "address", "street_address", "street address", "streetaddress"],
};

// Fields that are required for import
const REQUIRED_FIELDS = ["first_name", "last_name", "email"] as const;

// Lazy-initialized normalized alias map
let NORMALIZED_ALIAS_MAP: Map<string, string> | null = null;

function getNormalizedAliasMap(): Map<string, string> {
    if (NORMALIZED_ALIAS_MAP) return NORMALIZED_ALIAS_MAP;
    NORMALIZED_ALIAS_MAP = new Map();
    for (const [standard, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            const normalized = normalizeString(alias);
            if (!NORMALIZED_ALIAS_MAP.has(normalized)) {
                NORMALIZED_ALIAS_MAP.set(normalized, standard);
            }
        }
    }
    return NORMALIZED_ALIAS_MAP;
}

/**
 * Normalize a string for comparison: lowercase, trim, collapse whitespace/hyphens/underscores,
 * and split CamelCase/PascalCase.
 */
function normalizeString(input: string): string {
    // First handle CamelCase/PascalCase by inserting underscore before uppercase letters
    // that follow lowercase letters or digits (e.g., "FirstName" -> "First_Name" -> "first_name")
    let result = input
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .trim();
    // Collapse spaces, hyphens, underscores to single underscore
    result = result.replace(/[\s_-]+/g, "_");
    // Remove leading/trailing underscores
    result = result.replace(/^_+|_+$/g, "");
    return result;
}

// Columns that were successfully mapped (for reporting)
let columnMappingReport: Map<string, string> = new Map();

/**
 * Normalize a column header to its standard field name.
 * Returns the standard field name if recognized, otherwise returns null.
 * Also records the mapping in columnMappingReport.
 */
function normalizeColumnName(name: string): string | null {
    const normalized = normalizeString(name);
    
    // Check exact match in pre-normalized alias map
    const aliasMap = getNormalizedAliasMap();
    if (aliasMap.has(normalized)) {
        const standard = aliasMap.get(normalized)!;
        columnMappingReport.set(name, standard);
        return standard;
    }
    
    // No match found - don't silently map unknown columns
    return null;
}

/**
 * Normalize all column keys in a row, returning only recognized fields.
 * Unknown columns are logged as warnings but not included in output.
 */
function normalizeRowKeys(row: Record<string, any>): { data: StudentImportRow; warnings: string[] } {
    const normalized: Record<string, any> = {};
    const warnings: string[] = [];
    columnMappingReport = new Map();
    
    for (const [key, value] of Object.entries(row)) {
        const standardKey = normalizeColumnName(key);
        if (standardKey) {
            // Handle duplicate columns after normalization
            if (normalized[standardKey] !== undefined) {
                warnings.push(`Duplicate column after normalization: "${key}" → "${standardKey}" (already mapped from another column)`);
            }
            normalized[standardKey] = value;
        } else {
            warnings.push(`Unrecognized column ignored: "${key}"`);
        }
    }
    
    return { data: normalized as StudentImportRow, warnings };
}

export const registerStudentService = async (student: StudentProp) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Insert into users table FIRST (students.id FK references users.id)
        const userModel = new UserModel(connection);
        await userModel.createUser({
            id: student.id,
            email: student.email,
            password: student.password,
            role: "student",
            school_id: student.school_id,
            status: "active",
            name: `${student.first_name} ${student.last_name}`,
        });

        const studentModel = new StudentModel(connection);
        await studentModel.registerStudent(student);

        await connection.commit();
        return student.id;
    } catch(err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

export const studentLoginService = async (credentials: {email: string, password: string}) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        // Authenticate against users table
        const userModel = new UserModel(connection);
        const user = await userModel.getUserByEmail(credentials.email);

        if(user === null || user.role !== "student") {
            throw new NotFoundError("Student not found", 404);
        }

        if(user.status !== "active") {
            throw new UnauthorizedError(`Account is ${user.status}`);
        }

        const passwordVerify = await bcrypt.compare(credentials.password, user.password);
        if(!passwordVerify) {
            throw new BadRequestError("Incorrect password");
        }

        // Fetch student profile data
        const studentModel = new StudentModel(connection);
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const student = await studentModel.getStudentById(UUIDToBuffer(bufferToUUID(user.id)));

        const token = generateToken({
            id: bufferToUUID(user.id),
            role: "student",
            school_id: user.school_id ?? 0,
        });

        return {
            id: bufferToUUID(user.id),
            first_name: student?.first_name ?? "",
            last_name: student?.last_name ?? "",
            school_id: user.school_id ?? 0,
            admin_id: student ? bufferToUUID(student.admin_id) : "",
            token,
        };
    } finally {
        connection.release();
    }
};

export const getStudentsBySchoolIdService = async (school_id: number) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const studentModel = new StudentModel(connection);
        const students = await studentModel.getStudentsBySchoolId(school_id);
        return students.map(s => ({
            ...s,
            id: bufferToUUID(s.id),
            admin_id: bufferToUUID(s.admin_id),
        }));
    } finally {
        connection.release();
    }
};

export const getStudentByIdService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const studentModel = new StudentModel(connection);
        const student = await studentModel.getStudentById(UUIDToBuffer(id));
        if(student === null) {
            throw new NotFoundError("Student not found", 404);
        }
        return {
            ...student,
            id: bufferToUUID(student.id),
            admin_id: bufferToUUID(student.admin_id),
        };
    } finally {
        connection.release();
    }
};

export const updateStudentService = async (id: string, data: Partial<Pick<StudentProp, "first_name" | "last_name" | "email" | "contact_number">>) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const studentModel = new StudentModel(connection);
        await studentModel.updateStudent(UUIDToBuffer(id), data);
    } finally {
        connection.release();
    }
};

export const deleteStudentService = async (id: string) => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const { UUIDToBuffer } = await import("../helper/UUIDToBuffer.js");
        const studentModel = new StudentModel(connection);
        await studentModel.deleteStudent(UUIDToBuffer(id));
    } finally {
        connection.release();
    }
};

// ============================================================
// Shared internal function: parse & validate file for import
// ============================================================
interface ValidatedStudentRow {
    student: StudentProp;
    rowNum: number;
}

interface ParseValidationResult {
    rawRows: Record<string, any>[];
    normalizedRows: Array<{ data: StudentImportRow; warnings: string[] }>;
    allWarnings: string[];
    columnMapping: Map<string, string>;
    students: ValidatedStudentRow[];
    validationErrors: Array<{ 
        row: number; 
        email?: string; 
        error: string; 
        field?: string; 
        value?: string; 
        expected?: string;
    }>;
}

async function parseAndValidateImportFile(
    fileBuffer: Buffer,
    fileType: "csv" | "xlsx",
    schoolId: number,
    adminId: Buffer
): Promise<ParseValidationResult> {
    // Parse file
    let rawRows: Record<string, any>[] = [];
    
    if (fileType === "csv") {
        const content = fileBuffer.toString("utf-8");
        const parsed = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true,
        });
        rawRows = parsed as Record<string, any>[];
    } else {
        const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new BadRequestError("Excel file has no sheets");
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            throw new BadRequestError("Excel sheet not found");
        }
        rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
    }

    // Normalize column names in all rows
    const normalizedRows = rawRows.map(normalizeRowKeys);
    const allWarnings: string[] = [];
    const columnMapping = new Map<string, string>();
    
    // Collect warnings
    for (const nr of normalizedRows) {
        allWarnings.push(...nr.warnings);
    }
    // Capture column mapping from first row's headers
    if (normalizedRows.length > 0) {
        const firstRowHeaders = Object.keys(rawRows[0] || {});
        for (const header of firstRowHeaders) {
            const standard = normalizeColumnName(header);
            if (standard) {
                columnMapping.set(header, standard);
            }
        }
    }

    // Validate and transform rows
    const defaultPasswordHash = await hashPassword(getEnvName("USER_DEFAULT_PASSWORD"));

    const students: ValidatedStudentRow[] = [];
    const validationErrors: Array<{ 
        row: number; 
        email?: string; 
        error: string; 
        field?: string; 
        value?: string; 
        expected?: string;
    }> = [];

    for (let i = 0; i < normalizedRows.length; i++) {
        const normalizedRow = normalizedRows[i];
        if (!normalizedRow) continue;
        const row = normalizedRow.data;
        if (!row) continue;
        const rowNum = i + 2; // +2 for header (1) + 1-indexed

        // Validate required fields
        if (!row.first_name?.trim()) {
            validationErrors.push({ row: rowNum, error: "Missing required field: first_name", field: "first_name", value: String(row.first_name ?? ""), expected: "Non-empty string" });
            continue;
        }
        if (!row.last_name?.trim()) {
            validationErrors.push({ row: rowNum, error: "Missing required field: last_name", field: "last_name", value: String(row.last_name ?? ""), expected: "Non-empty string" });
            continue;
        }
        if (!row.email?.trim()) {
            validationErrors.push({ row: rowNum, error: "Missing required field: email", field: "email", value: String(row.email ?? ""), expected: "Valid email address" });
            continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.email)) {
            validationErrors.push({ row: rowNum, email: row.email, error: "Invalid email format", field: "email", value: row.email, expected: "user@domain.com" });
            continue;
        }

        // Validate sex if provided
        const sexRaw: unknown = row.sex;
        const sex = sexRaw ? String(sexRaw).trim().toLowerCase() : "";
        if (sex && !["male", "female"].includes(sex)) {
            validationErrors.push({ row: rowNum, email: row.email, error: "Invalid sex value", field: "sex", value: sexRaw as string, expected: "male or female" });
            continue;
        }

        // Validate date format if provided
        let dateOfBirth: string | null = null;
        if (row.date_of_birth) {
            const dobRaw: unknown = row.date_of_birth;
            let dob: string;
            if (dobRaw instanceof Date) {
                const pad = (n: number) => String(n).padStart(2, "0");
                dob = `${dobRaw.getFullYear()}-${pad(dobRaw.getMonth() + 1)}-${pad(dobRaw.getDate())}`;
            } else {
                dob = String(dobRaw).trim();
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
                validationErrors.push({ row: rowNum, email: row.email, error: "Invalid date format", field: "date_of_birth", value: String(dobRaw), expected: "YYYY-MM-DD" });
                continue;
            }
            dateOfBirth = dob;
        }

        const student: StudentProp = {
            id: generateRandomUUID(),
            first_name: row.first_name.trim(),
            middle_name: row.middle_name?.trim() || "",
            last_name: row.last_name.trim(),
            extension_name: row.extension_name?.trim() || "",
            email: row.email.trim().toLowerCase(),
            password: defaultPasswordHash,
            school_id: schoolId,
            lrn: row.lrn?.trim() || "",
            date_of_birth: dateOfBirth,
            place_of_birth: row.place_of_birth?.trim() || "",
            sex: (sex as "male" | "female") || "male",
            nationality: row.nationality?.trim() || "Filipino",
            contact_number: row.contact_number?.trim() || "",
            region: row.region?.trim() || "",
            province: row.province?.trim() || "",
            city_municipality: row.city_municipality?.trim() || "",
            barangay: row.barangay?.trim() || "",
            purok_street: row.purok_street?.trim() || "",
            admin_id: adminId,
        };

        students.push({ student, rowNum });
    }

    return {
        rawRows,
        normalizedRows,
        allWarnings,
        columnMapping,
        students,
        validationErrors,
    };
}

// Preview import - validates file without inserting
export const previewImportStudentsService = async (
    fileBuffer: Buffer,
    fileType: "csv" | "xlsx",
    schoolId: number
): Promise<{
    totalRows: number;
    validRows: number;
    validationErrors: Array<{ row: number; email?: string; error: string; field?: string; value?: string; expected?: string }>;
    warnings: string[];
    columnMapping: Record<string, string>;
    previewData: Array<{
        first_name: string;
        last_name: string;
        email: string;
        sex: string;
        contact_number: string;
    }>;
}> => {
    // Use a dummy adminId for preview (not used in preview)
    const dummyAdminId = Buffer.alloc(16);
    const result = await parseAndValidateImportFile(fileBuffer, fileType, schoolId, dummyAdminId);

    const previewData = result.students.map(s => ({
        first_name: s.student.first_name,
        last_name: s.student.last_name,
        email: s.student.email,
        sex: s.student.sex,
        contact_number: s.student.contact_number,
    }));

    return {
        totalRows: result.rawRows.length,
        validRows: result.students.length,
        validationErrors: result.validationErrors,
        warnings: result.allWarnings,
        columnMapping: Object.fromEntries(result.columnMapping),
        previewData,
    };
};

// Actual import - inserts into database
export const importStudentsService = async (
    fileBuffer: Buffer,
    fileType: "csv" | "xlsx",
    adminId: Buffer,
    schoolId: number
): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; email?: string; error: string; field?: string; value?: string; expected?: string }>;
    columnMapping: Record<string, string>;
    warnings: string[];
}> => {
    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        // Use shared parsing & validation
        const parsed = await parseAndValidateImportFile(fileBuffer, fileType, schoolId, adminId);

        const { rawRows, allWarnings, columnMapping, students, validationErrors } = parsed;

        // If all rows failed validation, return early
        if (students.length === 0) {
            return {
                success: 0,
                failed: validationErrors.length,
                errors: validationErrors,
                columnMapping: Object.fromEntries(columnMapping),
                warnings: allWarnings
            };
        }

        // Bulk insert
        await connection.beginTransaction();
        try {
            const userModel = new UserModel(connection);
            const studentModel = new StudentModel(connection);
            let success = 0;
            const insertErrors: Array<{ row: number; email?: string; error: string }> = [];

            for (const { student, rowNum } of students) {
                let userCreated = false;
                try {
                    // students.id has a FK to users.id — create the user account FIRST
                    await userModel.createUser({
                        id: student.id,
                        email: student.email,
                        password: student.password,
                        role: "student",
                        school_id: schoolId,
                        status: "active",
                        name: `${student.first_name} ${student.last_name}`,
                    });
                    userCreated = true;
                    await studentModel.registerStudent(student);
                    success++;
                } catch (err: any) {
                    // If user was created but student insert failed, clean up orphaned user
                    if (userCreated) {
                        try {
                            await userModel.deleteUser(student.id);
                        } catch { /* best effort cleanup */ }
                    }
                    // Models wrap low-level driver errors in InternalServerError, so the
                    // MySQL error (with .code / .sqlMessage) may be nested more than one level deep.
                    let originalError: any = err;
                    for (let depth = 0; depth < 5 && originalError && originalError.code === undefined; depth++) {
                        originalError = originalError?.cause ?? originalError?.original;
                    }
                    const error = originalError?.code === "ER_DUP_ENTRY"
                        ? `Duplicate email: ${student.email}`
                        : originalError?.sqlMessage || err?.cause?.sqlMessage || err?.message || "Unknown error";
                    console.error(`[students:import] row ${rowNum} (${student.email}) failed:`, error);
                    insertErrors.push({ row: rowNum, email: student.email, error });
                }
            }

            await connection.commit();

            return {
                success,
                failed: insertErrors.length + validationErrors.length,
                errors: [...validationErrors, ...insertErrors],
                columnMapping: Object.fromEntries(columnMapping),
                warnings: allWarnings
            };
        } catch(err) {
            await connection.rollback();
            throw err;
        }
    } finally {
        connection.release();
    }
};