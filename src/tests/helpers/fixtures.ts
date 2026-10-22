import type { PoolConnection } from "mysql2/promise";

import { generateRandomUUID } from "../../helper/generateRandomId.js";
import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { UUIDToBuffer } from "../../helper/UUIDToBuffer.js";
import { hashPassword } from "../../helper/hashPassword.js";
import type { FeatureKey } from "../../constant/features.js";
import type { UserRole } from "../../constant/users.js";
import type { TestIdentity } from "./api.js";
import type { SqlParams } from "./db.js";

/** Suffix that makes every fixture row unique per run. */
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const TEST_PASSWORD = "TestPass123!";

// High numeric range keeps fixture schools away from real development data.
const SCHOOL_ID_BASE = 900_000_000;
let schoolCounter = 0;
let nameCounter = 0;

let cachedPasswordHash: Promise<string> | undefined;
const hashedTestPassword = (): Promise<string> => {
    cachedPasswordHash ??= hashPassword(TEST_PASSWORD);
    return cachedPasswordHash;
};

const newId = (): string => bufferToUUID(generateRandomUUID());

const nextSchoolId = (): number =>
    SCHOOL_ID_BASE + (Date.now() % 1_000_000) + schoolCounter++;

export interface TestUser {
    id: string;
    email: string;
    password: string;
    role: UserRole;
    identity: TestIdentity;
}

export interface TestFaculty extends TestUser {
    firstName: string;
    lastName: string;
}

export interface TestStudent extends TestUser {
    firstName: string;
    lastName: string;
}

export interface TestSubject {
    id: string;
    name: string;
}

export interface TestSchoolYear {
    id: number;
    name: string;
}

export interface TestPeriod {
    id: number;
    name: string;
    schoolYearId: number;
}

export interface TestClass {
    id: string;
    name: string;
    schoolYearId: number;
    gradeLevel: string;
}

interface AddFacultyOptions {
    email?: string;
    role?: "teacher" | "cashier" | "register";
    status?: "active" | "inactive" | "suspended";
    isActive?: boolean;
    password?: string;
}

interface AddStudentOptions {
    email?: string;
    status?: "active" | "inactive" | "suspended";
    sex?: "male" | "female";
    password?: string;
}

interface AddSubjectOptions {
    name?: string;
    code?: string | null;
    isActive?: boolean;
}

interface AddSchoolYearOptions {
    name?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
}

interface AddPeriodOptions {
    name?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
}

interface AddClassOptions {
    adviserId: string;
    schoolYearId?: number;
    name?: string;
    capacity?: number;
    section?: string;
    gradeLevel?: string;
    isActive?: boolean;
}

export class TestSchool {
    readonly admin: TestUser;
    readonly currentSchoolYear: TestSchoolYear;
    readonly currentPeriod: TestPeriod;
    readonly schoolUuid: string;
    readonly schoolId: number;

    constructor(
        private readonly connection: PoolConnection,
        data: {
            schoolId: number;
            schoolUuid: string;
            admin: TestUser;
            currentSchoolYear: TestSchoolYear;
            currentPeriod: TestPeriod;
        }
    ) {
        this.schoolId = data.schoolId;
        this.schoolUuid = data.schoolUuid;
        this.admin = data.admin;
        this.currentSchoolYear = data.currentSchoolYear;
        this.currentPeriod = data.currentPeriod;
    }

    private nextLabel(prefix: string): string {
        return `${prefix} ${++nameCounter} ${RUN_ID}`;
    }

    async run(sql: string, params: SqlParams = []): Promise<unknown> {
        const [result] = await this.connection.execute(sql, params);
        return result;
    }

    async addFaculty(options: AddFacultyOptions = {}): Promise<TestFaculty> {
        const id = newId();
        const email = options.email ?? `faculty-${++nameCounter}-${RUN_ID}@test.local`;
        const password = options.password ?? TEST_PASSWORD;
        const passwordHash = password === TEST_PASSWORD
            ? await hashedTestPassword()
            : await hashPassword(password);
        const firstName = this.nextLabel("Teacher");
        const lastName = "Fixture";

        await this.connection.execute(
            `INSERT INTO users (id, email, password, role, status, name, school_id)
             VALUES (?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(id),
                email,
                passwordHash,
                "faculty",
                options.status ?? "active",
                `${firstName} ${lastName}`,
                this.schoolId,
            ]
        );
        await this.connection.execute(
            `INSERT INTO faculties
                (id, first_name, last_name, email, password, school_id, faculty_role, admin_id, is_active)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(id),
                firstName,
                lastName,
                email,
                passwordHash,
                this.schoolId,
                options.role ?? "teacher",
                UUIDToBuffer(this.admin.id),
                options.isActive === false ? 0 : 1,
            ]
        );

        return {
            id,
            email,
            password,
            role: "faculty",
            firstName,
            lastName,
            identity: { id, role: "faculty", school_id: this.schoolId },
        };
    }

    async addStudent(options: AddStudentOptions = {}): Promise<TestStudent> {
        const id = newId();
        const email = options.email ?? `student-${++nameCounter}-${RUN_ID}@test.local`;
        const password = options.password ?? TEST_PASSWORD;
        const passwordHash = password === TEST_PASSWORD
            ? await hashedTestPassword()
            : await hashPassword(password);
        const firstName = this.nextLabel("Student");
        const lastName = "Fixture";

        await this.connection.execute(
            `INSERT INTO users (id, email, password, role, status, name, school_id)
             VALUES (?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(id),
                email,
                passwordHash,
                "student",
                options.status ?? "active",
                `${firstName} ${lastName}`,
                this.schoolId,
            ]
        );
        await this.connection.execute(
            `INSERT INTO students
                (id, first_name, last_name, email, password, school_id, sex, admin_id)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(id),
                firstName,
                lastName,
                email,
                passwordHash,
                this.schoolId,
                options.sex ?? "male",
                UUIDToBuffer(this.admin.id),
            ]
        );

        return {
            id,
            email,
            password,
            role: "student",
            firstName,
            lastName,
            identity: { id, role: "student", school_id: this.schoolId },
        };
    }

    async addSubject(options: AddSubjectOptions = {}): Promise<TestSubject> {
        const id = newId();
        const name = options.name ?? this.nextLabel("Subject");

        await this.connection.execute(
            `INSERT INTO subjects (id, name, subject_code, description, school_id, admin_id, is_active)
             VALUES (?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(id),
                name,
                options.code ?? null,
                `${name} description`,
                this.schoolId,
                UUIDToBuffer(this.admin.id),
                options.isActive === false ? 0 : 1,
            ]
        );

        return { id, name };
    }

    async addSchoolYear(options: AddSchoolYearOptions = {}): Promise<TestSchoolYear> {
        const name = options.name ?? this.nextLabel("SY");
        const startDate = options.startDate ?? "2024-06-01";
        const endDate = options.endDate ?? "2025-05-31";

        if (options.isCurrent) {
            await this.connection.execute(
                `UPDATE school_years SET is_current = 0 WHERE school_id = ?`,
                [this.schoolId]
            );
        }

        const [result] = await this.connection.execute(
            `INSERT INTO school_years (name, start_date, end_date, school_id, is_current)
             VALUES (?,?,?,?,?)`,
            [name, startDate, endDate, this.schoolId, options.isCurrent ? 1 : 0]
        );

        return { id: Number((result as { insertId: number }).insertId), name };
    }

    async addPeriod(schoolYearId: number, options: AddPeriodOptions = {}): Promise<TestPeriod> {
        const name = options.name ?? this.nextLabel("Period");
        const [countRows] = await this.connection.execute(
            `SELECT COUNT(*) AS cnt FROM academic_periods WHERE school_id = ? AND school_year_id = ?`,
            [this.schoolId, schoolYearId]
        );
        const periodNumber = Number((countRows as { cnt: number }[])[0]?.cnt ?? 0) + 1;

        if (options.isCurrent) {
            await this.connection.execute(
                `UPDATE academic_periods SET is_current = 0 WHERE school_id = ? AND school_year_id = ?`,
                [this.schoolId, schoolYearId]
            );
        }

        const [result] = await this.connection.execute(
            `INSERT INTO academic_periods
                (school_id, school_year_id, name, period_number, start_date, end_date, is_current)
             VALUES (?,?,?,?,?,?,?)`,
            [
                this.schoolId,
                schoolYearId,
                name,
                periodNumber,
                options.startDate ?? "2024-06-01",
                options.endDate ?? "2024-08-31",
                options.isCurrent ? 1 : 0,
            ]
        );

        return {
            id: Number((result as { insertId: number }).insertId),
            name,
            schoolYearId,
        };
    }

    async addClass(options: AddClassOptions): Promise<TestClass> {
        const id = newId();
        const name = options.name ?? this.nextLabel("Class");
        const gradeLevel = options.gradeLevel ?? "7";
        const schoolYearId = options.schoolYearId ?? this.currentSchoolYear.id;

        await this.connection.execute(
            `INSERT INTO classes
                (id, class_name, school_id, school_year_id, faculty_id, capacity, section, grade_level, is_active)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(id),
                name,
                this.schoolId,
                schoolYearId,
                UUIDToBuffer(options.adviserId),
                options.capacity ?? 40,
                options.section ?? "A",
                gradeLevel,
                options.isActive === false ? 0 : 1,
            ]
        );

        return { id, name, schoolYearId, gradeLevel };
    }

    async assignFacultyToClass(
        classroom: TestClass,
        faculty: TestUser,
        subject: TestSubject
    ): Promise<void> {
        await this.connection.execute(
            `INSERT INTO class_faculties (class_id, faculty_id, subject_id, school_year_id)
             VALUES (?,?,?,?)`,
            [
                UUIDToBuffer(classroom.id),
                UUIDToBuffer(faculty.id),
                UUIDToBuffer(subject.id),
                classroom.schoolYearId,
            ]
        );
    }

    async enroll(
        student: TestStudent,
        classroom: TestClass,
        subjects: TestSubject[] = []
    ): Promise<string> {
        const enrollmentId = newId();

        await this.connection.execute(
            `INSERT INTO enrollments
                (id, student_id, class_id, school_year_id, grade_level, status,
                 class_name_snapshot, section_snapshot, adviser_name_snapshot)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(enrollmentId),
                UUIDToBuffer(student.id),
                UUIDToBuffer(classroom.id),
                classroom.schoolYearId,
                Number(classroom.gradeLevel),
                "active",
                classroom.name,
                "A",
                "Fixture Adviser",
            ]
        );

        for (const subject of subjects) {
            await this.connection.execute(
                `INSERT INTO enrollment_subjects (enrollment_id, subject_id, subject_name_snapshot)
                 VALUES (?,?,?)`,
                [UUIDToBuffer(enrollmentId), UUIDToBuffer(subject.id), subject.name]
            );
        }

        return enrollmentId;
    }

    async setFeature(key: FeatureKey, enabled: boolean): Promise<void> {
        await this.connection.execute(
            `INSERT INTO school_features (school_id, feature_key, is_enabled, updated_by)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)`,
            [this.schoolId, key, enabled ? 1 : 0, UUIDToBuffer(this.admin.id)]
        );
    }
}

/**
 * Creates a school with its admin account, a current school year and its first
 * current period — the same state a freshly registered school is in.
 */
export async function createSchoolFixture(
    connection: PoolConnection,
    options: { name?: string } = {}
): Promise<TestSchool> {
    const schoolUuid = newId();
    const schoolId = nextSchoolId();
    const adminId = newId();
    const adminEmail = `admin-${schoolId}@test.local`;
    const passwordHash = await hashedTestPassword();
    const schoolName = options.name ?? `Test School ${RUN_ID}-${schoolId}`;

    // users.school_id -> schools.school_id and schools.admin_id -> school_admins.id
    // form a cycle, so the three rows are written with FK checks disabled.
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
        await connection.execute(
            `INSERT INTO users (id, email, password, role, status, name, school_id)
             VALUES (?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(adminId),
                adminEmail,
                passwordHash,
                "school_admin",
                "active",
                "School Admin",
                schoolId,
            ]
        );
        await connection.execute(
            `INSERT INTO school_admins (id, email, school_id, password)
             VALUES (?,?,?,?)`,
            [UUIDToBuffer(adminId), adminEmail, schoolId, passwordHash]
        );
        await connection.execute(
            `INSERT INTO schools
                (id, school_id, school_name, school_level, academic_system, period_count,
                 academic_config_completed, school_email, address, region, province, city,
                 contact_number, school_logo, school_admin, admin_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                UUIDToBuffer(schoolUuid),
                schoolId,
                schoolName,
                1,
                "quarter",
                4,
                1,
                `school-${schoolId}@test.local`,
                "Address",
                "Region",
                "Province",
                "City",
                "000",
                "",
                "School Admin",
                UUIDToBuffer(adminId),
            ]
        );
    } finally {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    const school = new TestSchool(connection, {
        schoolId,
        schoolUuid,
        admin: {
            id: adminId,
            email: adminEmail,
            password: TEST_PASSWORD,
            role: "school_admin",
            identity: { id: adminId, role: "school_admin", school_id: schoolId },
        },
        currentSchoolYear: { id: 0, name: "" },
        currentPeriod: { id: 0, name: "", schoolYearId: 0 },
    });

    const currentSchoolYear = await school.addSchoolYear({ isCurrent: true });
    const currentPeriod = await school.addPeriod(currentSchoolYear.id, { isCurrent: true });

    return new TestSchool(connection, {
        schoolId,
        schoolUuid,
        admin: school.admin,
        currentSchoolYear,
        currentPeriod,
    });
}

/** Creates a global super admin account (no school). */
export async function createSuperAdmin(
    connection: PoolConnection,
    email = `super-${++nameCounter}-${RUN_ID}@test.local`
): Promise<TestUser> {
    const id = newId();
    const passwordHash = await hashedTestPassword();

    await connection.execute(
        `INSERT INTO users (id, email, password, role, status, name, school_id)
         VALUES (?,?,?,?,?,?,NULL)`,
        [UUIDToBuffer(id), email, passwordHash, "super_admin", "active", email]
    );

    return {
        id,
        email,
        password: TEST_PASSWORD,
        role: "super_admin",
        identity: { id, role: "super_admin" },
    };
}
