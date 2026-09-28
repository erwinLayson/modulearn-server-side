/**
 * Seeder: sample students + full academic history.
 *
 * Everything is created inside the first school found in the `schools` table.
 *
 * Setup (idempotent - existing rows are reused):
 *   - 4 past school years (+ their academic periods) and the current school year
 *   - a standard set of subjects, and enough faculties to be class advisers
 *   - one class per section per school year, with subject teachers and grading weights
 *
 * Data (all-or-nothing transaction):
 *   - N students (users + students rows)
 *   - for every student/year: an enrollment + its subjects, grade items, scores,
 *     and frozen period + year-end finalizations
 *
 * Usage (from the server folder):
 *   npx tsx src/seeders/001_seed_students_and_records.ts
 *   npx tsx src/seeders/001_seed_students_and_records.ts --reset
 *
 * Env overrides: SEED_STUDENT_COUNT, SEED_HISTORY_YEARS, SEED_RESET=1
 * Every seeded account shares the password in CONFIG.password below.
 */

import dotenv from "dotenv";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../config/database.js";
import { getEnvName } from "../helper/getEnv.js";
import { generateRandomUUID } from "../helper/generateRandomId.js";
import { hashPassword } from "../helper/hashPassword.js";
import { computeNormalizedFinalGrade } from "../helper/gradeCalculation.js";
import { generatePeriodsService } from "../service/academicPeriods.js";

// Env must be loaded before the pool is created (same order as migration.ts)
dotenv.config({ path: ".env" });
const isProduction = getEnvName("SYSTEM_STATUS") === "production";
dotenv.config({ path: isProduction ? ".env.production" : ".env.development" });

// ========== CONFIG ==========
type Category = "activities" | "quizzes" | "exams";

const CONFIG = {
    /** How many students to create */
    studentCount: Number(process.env.SEED_STUDENT_COUNT ?? 50),
    /** How many completed school years of history to create */
    historyYears: Number(process.env.SEED_HISTORY_YEARS ?? 4),
    /** Grade level of the oldest seeded year - each year moves up by 1 */
    baseGrade: 7,
    sections: ["A", "B"],
    categories: ["activities", "quizzes", "exams"] as Category[],
    categoryLabel: { activities: "Activity", quizzes: "Quiz", exams: "Exam" } as Record<Category, string>,
    /** Max score per grade item, per category */
    maxScore: { activities: 50, quizzes: 30, exams: 100 } as Record<Category, number>,
    /** Global grading weights (must add up to 100) */
    weights: { activities: 30, quizzes: 30, exams: 30, attendance: 10 } as Record<Category | "attendance", number>,
    itemsPerCategoryPerPeriod: 2,
    classCapacity: 40,
    password: "password123",
    studentEmailPrefix: "seed.student.",
    teacherEmailPrefix: "seed.teacher.",
    emailDomain: "example.com",
    /** Deterministic score spread */
    abilityMin: 62,
    abilitySpread: 33,
    reset: process.argv.includes("--reset") || process.env.SEED_RESET === "1",
};

const SCHOOL_YEAR_START_MONTH_DAY = "-06-01";
const SCHOOL_YEAR_END_MONTH_DAY = "-04-30";

const SUBJECT_NAMES = [
    "Mathematics",
    "English",
    "Science",
    "Filipino",
    "Araling Panlipunan",
    "MAPEH",
];

const FIRST_NAMES_MALE = [
    "Juan", "Miguel", "Jose", "Rafael", "Gabriel", "Andres", "Marco", "Paolo",
    "Luis", "Ramon", "Carlo", "Dennis", "Enrico", "Ferdinand", "Gregorio", "Hector",
];
const FIRST_NAMES_FEMALE = [
    "Maria", "Ana", "Bella", "Carmela", "Diana", "Elena", "Faith", "Grace",
    "Hannah", "Isabel", "Jasmine", "Kristine", "Liza", "Mikaela", "Nadine", "Olivia",
];
const MIDDLE_NAMES = [
    "Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Villanueva", "Mendoza", "Ramos",
    "Aquino", "Salazar",
];
const LAST_NAMES = [
    "Dela Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Torres", "Flores", "Ramos",
    "Bautista", "Villanueva", "Aquino", "Navarro", "Domingo", "Salazar", "Castillo",
    "Aguilar", "Pascual", "Rivera", "Gonzales", "Lorenzo",
];
const PROVINCES = [
    { region: "Region IV-A (CALABARZON)", province: "Laguna", city: "Calamba", barangay: "Poblacion" },
    { region: "Region IV-A (CALABARZON)", province: "Cavite", city: "Dasmariñas", barangay: "San Isidro" },
    { region: "National Capital Region", province: "Metro Manila", city: "Quezon City", barangay: "Bagong Silangan" },
    { region: "Region III (Central Luzon)", province: "Pampanga", city: "San Fernando", barangay: "Santo Rosario" },
];

// ========== ROW SHAPES ==========
interface SchoolRow {
    school_id: number;
    school_name: string;
    admin_id: Buffer;
    academic_system: string;
    period_count: number;
}

interface YearRow {
    id: number;
    name: string;
    start_date: Date | string;
    end_date: Date | string;
    is_current: number;
}

interface PeriodRow {
    id: number;
    name: string;
    period_number: number;
    start_date: Date | string;
    end_date: Date | string;
}

interface SubjectRow {
    id: Buffer;
    name: string;
}

interface FacultyRow {
    id: Buffer;
    first_name: string;
    last_name: string;
}

interface GradeItemRow {
    id: Buffer;
    category: Category;
    max_score: number;
    period_id: number;
}

interface SubjectPlan {
    id: Buffer;
    name: string;
    teacherId: Buffer;
    items: GradeItemRow[];
}

interface ClassPlan {
    id: Buffer;
    class_name: string;
    section: string;
    grade: string;
    adviser_name: string;
    subjects: SubjectPlan[];
}

type ValueRow = (string | number | Buffer | null)[];

// ========== PRNG (deterministic output) ==========
function createRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick<T>(rng: () => number, values: T[]): T {
    const value = values[Math.floor(rng() * values.length)];
    if (value === undefined) throw new Error("pick() received an empty list");
    return value;
}

function randInt(rng: () => number, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function toIsoDate(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function addDays(date: Date | string, days: number): string {
    const base = new Date(toIsoDate(date));
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
}

function startYearOf(schoolYear: YearRow): number {
    const fromName = Number(schoolYear.name.split("-")[0]);
    if (Number.isFinite(fromName) && fromName > 1900) return fromName;
    return Number(toIsoDate(schoolYear.start_date).slice(0, 4));
}

// ========== LOW LEVEL HELPERS ==========
async function bulkInsert(
    connection: PoolConnection,
    table: string,
    columns: string[],
    rows: ValueRow[],
    chunkSize = 500
): Promise<void> {
    if (rows.length === 0) return;
    const columnList = columns.join(", ");
    const singleRow = `(${columns.map(() => "?").join(", ")})`;

    for (let start = 0; start < rows.length; start += chunkSize) {
        const chunk = rows.slice(start, start + chunkSize);
        const placeholders = chunk.map(() => singleRow).join(", ");
        await connection.query(
            `INSERT INTO ${table} (${columnList}) VALUES ${placeholders}`,
            chunk.flat()
        );
    }
}

async function getTargetSchool(connection: PoolConnection): Promise<SchoolRow> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT school_id, school_name, admin_id, academic_system, period_count
         FROM schools ORDER BY school_id ASC LIMIT 1`
    );
    const school = rows[0] as SchoolRow | undefined;
    if (!school) {
        throw new Error(
            "No school found. Create a school (with its admin) before seeding students."
        );
    }
    return school;
}

async function countSeededStudents(connection: PoolConnection, schoolId: number): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM students WHERE school_id = ? AND email LIKE ?`,
        [schoolId, `${CONFIG.studentEmailPrefix}%@${CONFIG.emailDomain}`]
    );
    return Number((rows[0] as { cnt: number } | undefined)?.cnt ?? 0);
}

async function deleteSeededStudents(connection: PoolConnection, schoolId: number): Promise<number> {
    // Deleting the auth rows cascades to students -> enrollments -> enrollment_subjects,
    // grades and period_finalizations (all declared ON DELETE CASCADE).
    const [result] = await connection.query<ResultSetHeader>(
        `DELETE FROM users WHERE school_id = ? AND email LIKE ?`,
        [schoolId, `${CONFIG.studentEmailPrefix}%@${CONFIG.emailDomain}`]
    );
    return result.affectedRows;
}

// ========== SETUP: SCHOOL YEARS ==========
async function ensureSchoolYears(connection: PoolConnection, school: SchoolRow): Promise<YearRow[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, name, start_date, end_date, is_current
         FROM school_years WHERE school_id = ? ORDER BY start_date ASC`,
        [school.school_id]
    );
    const existing = rows as YearRow[];
    const byName = new Map(existing.map(year => [year.name, year]));

    let current = existing.find(year => year.is_current === 1);
    if (!current) {
        const calendarYear = new Date().getFullYear();
        const name = `${calendarYear}-${calendarYear + 1}`;
        const alreadyThere = byName.get(name);
        if (alreadyThere) {
            await connection.query("UPDATE school_years SET is_current = 1 WHERE id = ?", [alreadyThere.id]);
            alreadyThere.is_current = 1;
            current = alreadyThere;
        } else {
            const [insert] = await connection.query<ResultSetHeader>(
                `INSERT INTO school_years (name, start_date, end_date, school_id, is_current) VALUES (?, ?, ?, ?, 1)`,
                [
                    name,
                    `${calendarYear}${SCHOOL_YEAR_START_MONTH_DAY}`,
                    `${calendarYear + 1}${SCHOOL_YEAR_END_MONTH_DAY}`,
                    school.school_id,
                ]
            );
            current = {
                id: insert.insertId,
                name,
                start_date: `${calendarYear}${SCHOOL_YEAR_START_MONTH_DAY}`,
                end_date: `${calendarYear + 1}${SCHOOL_YEAR_END_MONTH_DAY}`,
                is_current: 1,
            };
            byName.set(name, current);
        }
    }

    const baseYear = startYearOf(current);
    const history: YearRow[] = [];
    for (let offset = CONFIG.historyYears; offset >= 1; offset--) {
        const startYear = baseYear - offset;
        const name = `${startYear}-${startYear + 1}`;
        const found = byName.get(name);
        if (found) {
            history.push(found);
            continue;
        }
        const [insert] = await connection.query<ResultSetHeader>(
            `INSERT INTO school_years (name, start_date, end_date, school_id, is_current) VALUES (?, ?, ?, ?, 0)`,
            [
                name,
                `${startYear}${SCHOOL_YEAR_START_MONTH_DAY}`,
                `${startYear + 1}${SCHOOL_YEAR_END_MONTH_DAY}`,
                school.school_id,
            ]
        );
        const created: YearRow = {
            id: insert.insertId,
            name,
            start_date: `${startYear}${SCHOOL_YEAR_START_MONTH_DAY}`,
            end_date: `${startYear + 1}${SCHOOL_YEAR_END_MONTH_DAY}`,
            is_current: 0,
        };
        byName.set(name, created);
        history.push(created);
    }

    return [...history, current];
}

// ========== SETUP: ACADEMIC PERIODS ==========
async function ensurePeriods(
    connection: PoolConnection,
    school: SchoolRow,
    year: YearRow
): Promise<PeriodRow[]> {
    const read = async (): Promise<PeriodRow[]> => {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT id, name, period_number, start_date, end_date
             FROM academic_periods WHERE school_id = ? AND school_year_id = ?
             ORDER BY period_number ASC`,
            [school.school_id, year.id]
        );
        return rows as PeriodRow[];
    };

    if ((await read()).length === 0) {
        // Reuses the app's own generator (period naming + date distribution)
        await generatePeriodsService(school.school_id, year.id);
    }

    await connection.query(
        `UPDATE academic_periods SET is_current = 0 WHERE school_id = ? AND school_year_id = ?`,
        [school.school_id, year.id]
    );

    if (year.is_current === 1) {
        // Mark the period that contains today as current (falls back to the first one)
        const today = new Date().toISOString().slice(0, 10);
        const periods = await read();
        const active = periods.find(
            period => toIsoDate(period.start_date) <= today && toIsoDate(period.end_date) >= today
        ) ?? periods[0];
        if (active) {
            await connection.query(
                "UPDATE academic_periods SET is_current = 1 WHERE id = ?",
                [active.id]
            );
        }
    }

    return read();
}

// ========== SETUP: SUBJECTS ==========
async function ensureSubjects(connection: PoolConnection, school: SchoolRow): Promise<SubjectRow[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT id, name FROM subjects WHERE school_id = ?",
        [school.school_id]
    );
    const byName = new Map<string, SubjectRow>(
        (rows as SubjectRow[]).map(row => [row.name.toLowerCase(), row])
    );

    const subjects: SubjectRow[] = [];
    for (const name of SUBJECT_NAMES) {
        const existing = byName.get(name.toLowerCase());
        if (existing) {
            subjects.push(existing);
            continue;
        }
        const id = generateRandomUUID();
        await connection.query(
            `INSERT INTO subjects (id, name, subject_code, description, school_id, admin_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                name,
                name.slice(0, 3).toUpperCase(),
                `${name} for the seeded sample data`,
                school.school_id,
                school.admin_id,
            ]
        );
        const created = { id, name };
        byName.set(name.toLowerCase(), created);
        subjects.push(created);
    }
    return subjects;
}

// ========== SETUP: FACULTIES ==========
async function ensureFaculties(
    connection: PoolConnection,
    school: SchoolRow,
    needed: number
): Promise<FacultyRow[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, first_name, last_name FROM faculties WHERE school_id = ? ORDER BY created_at ASC`,
        [school.school_id]
    );
    const faculties = rows as FacultyRow[];

    const rng = createRng(20260401);
    const passwordHash = await hashPassword(CONFIG.password);

    let index = 1;
    while (faculties.length < needed) {
        const email = `${CONFIG.teacherEmailPrefix}${index}@${CONFIG.emailDomain}`;
        index++;

        const first = pick(rng, FIRST_NAMES_MALE);
        const last = pick(rng, LAST_NAMES);
        const fullName = `${first} ${last}`;

        const [existing] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM users WHERE email = ? AND school_id = ? LIMIT 1",
            [email, school.school_id]
        );
        if (existing.length > 0) {
            const id = (existing[0] as { id: Buffer }).id;
            const [facultyRows] = await connection.query<RowDataPacket[]>(
                "SELECT id, first_name, last_name FROM faculties WHERE id = ? LIMIT 1",
                [id]
            );
            if (facultyRows.length > 0) {
                faculties.push(facultyRows[0] as FacultyRow);
            }
            continue;
        }

        const id = generateRandomUUID();
        await connection.query(
            `INSERT INTO users (id, email, password, role, school_id, status, name)
             VALUES (?, ?, ?, 'faculty', ?, 'active', ?)`,
            [id, email, passwordHash, school.school_id, fullName]
        );
        await connection.query(
            `INSERT INTO faculties (id, first_name, last_name, email, password, school_id, contact_number, faculty_role, admin_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'teacher', ?)`,
            [
                id,
                first,
                last,
                email,
                passwordHash,
                school.school_id,
                `0917${String(2000000 + index).slice(0, 7)}`,
                school.admin_id,
            ]
        );
        faculties.push({ id, first_name: first, last_name: last });
    }

    return faculties;
}

async function ensureSubjectFaculties(
    connection: PoolConnection,
    subjects: SubjectRow[],
    faculties: FacultyRow[]
): Promise<void> {
    for (let i = 0; i < subjects.length; i++) {
        const subject = subjects[i];
        const faculty = faculties[i % faculties.length];
        if (!subject || !faculty) continue;
        const [existing] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM subject_faculties WHERE subject_id = ? AND faculty_id = ? LIMIT 1",
            [subject.id, faculty.id]
        );
        if (existing.length > 0) continue;
        await connection.query(
            "INSERT INTO subject_faculties (subject_id, faculty_id) VALUES (?, ?)",
            [subject.id, faculty.id]
        );
    }
}

// ========== SETUP: CLASSES / CLASS FACULTIES / WEIGHTS ==========
async function ensureClassPlans(
    connection: PoolConnection,
    school: SchoolRow,
    years: YearRow[],
    subjects: SubjectRow[],
    faculties: FacultyRow[],
    periodsByYear: Map<number, PeriodRow[]>
): Promise<Map<number, ClassPlan[]>> {
    const plans = new Map<number, ClassPlan[]>();

    for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
        const year = years[yearIndex];
        if (!year) continue;
        const grade = String(CONFIG.baseGrade + yearIndex);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT c.id, c.class_name, c.section, c.grade_level, c.faculty_id,
                    f.first_name, f.last_name
             FROM classes c
             LEFT JOIN faculties f ON f.id = c.faculty_id
             WHERE c.school_id = ? AND c.school_year_id = ?`,
            [school.school_id, year.id]
        );
        const existing = rows as {
            id: Buffer; class_name: string; section: string | null; grade_level: string | null;
            faculty_id: Buffer; first_name: string | null; last_name: string | null;
        }[];

        const yearPlans: ClassPlan[] = [];

        for (let sectionIndex = 0; sectionIndex < CONFIG.sections.length; sectionIndex++) {
            const section = CONFIG.sections[sectionIndex];
            if (!section) continue;

            const found = existing.find(
                row => row.section === section && String(row.grade_level) === grade
            );

            let classId: Buffer;
            let className: string;
            let adviserName: string;

            if (found) {
                classId = found.id;
                className = found.class_name;
                adviserName = [found.first_name, found.last_name].filter(Boolean).join(" ");
            } else {
                const adviserIndex = (yearIndex * CONFIG.sections.length + sectionIndex) % faculties.length;
                const adviser = faculties[adviserIndex];
                if (!adviser) throw new Error("Not enough faculties to assign a class adviser");
                classId = generateRandomUUID();
                className = `Grade ${grade} - ${section}`;
                adviserName = `${adviser.first_name} ${adviser.last_name}`;

                const schedule = [
                    { day: "Monday", start_time: "07:30", end_time: "11:30", room: `Room ${grade}${section}` },
                    { day: "Wednesday", start_time: "07:30", end_time: "11:30", room: `Room ${grade}${section}` },
                    { day: "Friday", start_time: "07:30", end_time: "11:30", room: `Room ${grade}${section}` },
                ];

                await connection.query(
                    `INSERT INTO classes
                        (id, class_name, school_id, school_year_id, faculty_id, capacity, section, grade_level, schedule)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        classId, className, school.school_id, year.id, adviser.id,
                        CONFIG.classCapacity, section, grade, JSON.stringify(schedule),
                    ]
                );
            }

            const periods = periodsByYear.get(year.id) ?? [];
            const subjectPlans: SubjectPlan[] = [];

            for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex++) {
                const subject = subjects[subjectIndex];
                if (!subject) continue;

                const teacher = faculties[(yearIndex + subjectIndex) % faculties.length];
                if (!teacher) throw new Error("Not enough faculties to assign a subject teacher");

                // class_faculties drives the subject list the enrollment pages read
                const [existingCf] = await connection.query<RowDataPacket[]>(
                    `SELECT id FROM class_faculties
                     WHERE class_id = ? AND subject_id = ? AND school_year_id = ? LIMIT 1`,
                    [classId, subject.id, year.id]
                );
                if (existingCf.length === 0) {
                    await connection.query(
                        `INSERT INTO class_faculties (class_id, faculty_id, subject_id, school_year_id)
                         VALUES (?, ?, ?, ?)`,
                        [classId, teacher.id, subject.id, year.id]
                    );
                }

                for (const [category, weight] of Object.entries(CONFIG.weights)) {
                    const [existingWeight] = await connection.query<RowDataPacket[]>(
                        `SELECT id FROM grading_weights
                         WHERE class_id = ? AND subject_id = ? AND category = ? LIMIT 1`,
                        [classId, subject.id, category]
                    );
                    if (existingWeight.length === 0) {
                        await connection.query(
                            `INSERT INTO grading_weights (class_id, subject_id, category, weight)
                             VALUES (?, ?, ?, ?)`,
                            [classId, subject.id, category, weight]
                        );
                    }
                }

                subjectPlans.push({
                    id: subject.id,
                    name: subject.name,
                    teacherId: teacher.id,
                    items: await ensureGradeItems(connection, classId, subject.id, teacher.id, periods),
                });
            }

            yearPlans.push({
                id: classId,
                class_name: className,
                section,
                grade,
                adviser_name: adviserName,
                subjects: subjectPlans,
            });
        }

        plans.set(year.id, yearPlans);
    }

    return plans;
}

async function ensureGradeItems(
    connection: PoolConnection,
    classId: Buffer,
    subjectId: Buffer,
    facultyId: Buffer,
    periods: PeriodRow[]
): Promise<GradeItemRow[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, title, category, max_score, period_id FROM grade_items
         WHERE class_id = ? AND subject_id = ?`,
        [classId, subjectId]
    );
    const byTitle = new Map<string, { id: Buffer; category: Category; max_score: number; period_id: number }>(
        (rows as { id: Buffer; title: string; category: Category; max_score: number; period_id: number }[])
            .map(row => [row.title, row])
    );

    const items: GradeItemRow[] = [];
    for (const period of periods) {
        for (const category of CONFIG.categories) {
            for (let n = 1; n <= CONFIG.itemsPerCategoryPerPeriod; n++) {
                const title = `${period.name} ${CONFIG.categoryLabel[category]} ${n}`;
                const existing = byTitle.get(title);
                if (existing) {
                    items.push({
                        id: existing.id,
                        category: existing.category,
                        max_score: Number(existing.max_score),
                        period_id: Number(existing.period_id),
                    });
                    continue;
                }

                const id = generateRandomUUID();
                const maxScore = CONFIG.maxScore[category];
                const dueDate = addDays(period.start_date, 7 + n * 5);

                await connection.query(
                    `INSERT INTO grade_items
                        (id, class_id, subject_id, faculty_id, category, title, max_score, due_date, period_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, classId, subjectId, facultyId, category, title, maxScore, dueDate, period.id]
                );
                items.push({ id, category, max_score: maxScore, period_id: period.id });
            }
        }
    }
    return items;
}

// ========== DATA: STUDENTS + RECORDS ==========
interface SeedContext {
    connection: PoolConnection;
    school: SchoolRow;
    years: YearRow[];
    periodsByYear: Map<number, PeriodRow[]>;
    classPlans: Map<number, ClassPlan[]>;
    passwordHash: string;
}

interface SeedCounts {
    students: number;
    enrollments: number;
    enrollmentSubjects: number;
    gradeItems: number;
    grades: number;
    finalizations: number;
}

function buildStudentPersona(index: number, rng: () => number, currentStartYear: number) {
    const sex: "male" | "female" = index % 2 === 0 ? "male" : "female";
    const first = pick(rng, sex === "male" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
    const middle = pick(rng, MIDDLE_NAMES);
    const last = pick(rng, LAST_NAMES);
    const address = pick(rng, PROVINCES);
    // Grade 7 in the oldest year, so age is derived from the highest grade level reached.
    const highestGrade = CONFIG.baseGrade + CONFIG.historyYears;
    const birthYear = currentStartYear - (highestGrade + 5);
    const month = String(randInt(rng, 1, 12)).padStart(2, "0");
    const day = String(randInt(rng, 1, 28)).padStart(2, "0");

    return {
        sex,
        first_name: first,
        middle_name: middle,
        last_name: last,
        extension_name: "",
        email: `${CONFIG.studentEmailPrefix}${String(index + 1).padStart(3, "0")}@${CONFIG.emailDomain}`,
        lrn: String(100000000000 + index * 7919).slice(0, 12),
        date_of_birth: `${birthYear}-${month}-${day}`,
        place_of_birth: `${address.city}, ${address.province}`,
        nationality: "Filipino",
        contact_number: `09${String(171000000 + index * 137).slice(0, 9)}`,
        region: address.region,
        province: address.province,
        city_municipality: address.city,
        barangay: address.barangay,
        purok_street: `${randInt(rng, 1, 250)} ${pick(rng, LAST_NAMES)} Street`,
    };
}

async function seedStudentRecords(ctx: SeedContext): Promise<SeedCounts> {
    const { connection, school, years, periodsByYear, classPlans, passwordHash } = ctx;

    const enrollmentRows: ValueRow[] = [];
    const enrollmentSubjectRows: ValueRow[] = [];
    const gradeRows: ValueRow[] = [];
    const finalizationRows: ValueRow[] = [];

    const weightsMap = new Map<string, number>(Object.entries(CONFIG.weights));
    const today = new Date().toISOString().slice(0, 10);
    const currentStartYear = startYearOf(years[years.length - 1] as YearRow);

    for (let index = 0; index < CONFIG.studentCount; index++) {
        const rng = createRng(1000003 + index * 7919);
        const persona = buildStudentPersona(index, rng, currentStartYear);
        const studentId = generateRandomUUID();
        const fullName = `${persona.first_name} ${persona.middle_name} ${persona.last_name}`;

        await connection.query(
            `INSERT INTO users (id, email, password, role, school_id, status, name)
             VALUES (?, ?, ?, 'student', ?, 'active', ?)`,
            [studentId, persona.email, passwordHash, school.school_id, fullName]
        );

        await connection.query(
            `INSERT INTO students
                (id, first_name, middle_name, last_name, extension_name, email, password, school_id,
                 lrn, date_of_birth, place_of_birth, sex, nationality, region, province,
                 city_municipality, barangay, purok_street, contact_number, admin_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                studentId, persona.first_name, persona.middle_name, persona.last_name, persona.extension_name,
                persona.email, passwordHash, school.school_id, persona.lrn, persona.date_of_birth,
                persona.place_of_birth, persona.sex, persona.nationality, persona.region, persona.province,
                persona.city_municipality, persona.barangay, persona.purok_street, persona.contact_number,
                school.admin_id,
            ]
        );

        // Half the cohort sits in each section
        const sectionIndex = index % CONFIG.sections.length;
        const ability = CONFIG.abilityMin + rng() * CONFIG.abilitySpread;

        for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
            const year = years[yearIndex];
            if (!year) continue;
            const classPlan = (classPlans.get(year.id) ?? [])[sectionIndex];
            const periods = periodsByYear.get(year.id) ?? [];
            if (!classPlan || periods.length === 0) continue;

            const isCurrentYear = yearIndex === years.length - 1;
            const enrollmentId = generateRandomUUID();
            const yearStart = startYearOf(year);

            enrollmentRows.push([
                enrollmentId,
                studentId,
                classPlan.id,
                year.id,
                Number(classPlan.grade),
                isCurrentYear ? "active" : "completed",
                classPlan.class_name,
                classPlan.section,
                classPlan.adviser_name,
                `${yearStart}-06-05 08:00:00`,
            ]);

            for (const subject of classPlan.subjects) {
                enrollmentSubjectRows.push([enrollmentId, subject.id, subject.name]);

                const subjectOffset = (rng() - 0.5) * 14;
                // itemId -> score, reused for both the grade rows and the frozen finals
                const scoresByPeriod = new Map<number, { score: number; max: number; category: Category }[]>();
                const allItemScores: { score: number; max: number; category: Category }[] = [];

                for (const item of subject.items) {
                    const percent = clamp(
                        ability + subjectOffset + (rng() - 0.5) * 18,
                        50,
                        100
                    );
                    const score = round2((percent / 100) * item.max_score);
                    const bucket = scoresByPeriod.get(item.period_id) ?? [];
                    const entry = { score, max: item.max_score, category: item.category };
                    bucket.push(entry);
                    scoresByPeriod.set(item.period_id, bucket);
                    allItemScores.push(entry);

                    gradeRows.push([item.id, studentId, score, subject.teacherId]);
                }

                const averageFor = (
                    entries: { score: number; max: number; category: Category }[]
                ): Map<string, number | null> => {
                    const averages = new Map<string, number | null>();
                    for (const category of CONFIG.categories) {
                        const catItems = entries.filter(entry => entry.category === category);
                        const max = catItems.reduce((sum, entry) => sum + entry.max, 0);
                        const score = catItems.reduce((sum, entry) => sum + entry.score, 0);
                        averages.set(category, max > 0 ? round2((score / max) * 100) : null);
                    }
                    return averages;
                };

                for (const period of periods) {
                    const bucket = scoresByPeriod.get(period.id);
                    if (!bucket || bucket.length === 0) continue;
                    // Only freeze periods that have already ended
                    if (isCurrentYear && toIsoDate(period.end_date) >= today) continue;

                    finalizationRows.push([
                        school.school_id,
                        year.id,
                        period.id,
                        classPlan.id,
                        subject.id,
                        studentId,
                        computeNormalizedFinalGrade(averageFor(bucket), 0, false, weightsMap),
                        subject.teacherId,
                    ]);
                }

                // Year-end finalization (period_id NULL) only for completed years
                if (!isCurrentYear) {
                    finalizationRows.push([
                        school.school_id,
                        year.id,
                        null,
                        classPlan.id,
                        subject.id,
                        studentId,
                        computeNormalizedFinalGrade(averageFor(allItemScores), 0, false, weightsMap),
                        subject.teacherId,
                    ]);
                }
            }
        }
    }

    await bulkInsert(
        connection,
        "enrollments",
        ["id", "student_id", "class_id", "school_year_id", "grade_level", "status",
         "class_name_snapshot", "section_snapshot", "adviser_name_snapshot", "enrolled_at"],
        enrollmentRows
    );
    await bulkInsert(
        connection,
        "enrollment_subjects",
        ["enrollment_id", "subject_id", "subject_name_snapshot"],
        enrollmentSubjectRows
    );
    await bulkInsert(
        connection,
        "grades",
        ["grade_item_id", "student_id", "score", "recorded_by"],
        gradeRows
    );
    await bulkInsert(
        connection,
        "period_finalizations",
        ["school_id", "school_year_id", "period_id", "class_id", "subject_id", "student_id",
         "final_grade", "finalized_by"],
        finalizationRows
    );

    return {
        students: CONFIG.studentCount,
        enrollments: enrollmentRows.length,
        enrollmentSubjects: enrollmentSubjectRows.length,
        gradeItems: [...classPlans.values()].flat().reduce(
            (sum, plan) => sum + plan.subjects.reduce((s, subject) => s + subject.items.length, 0),
            0
        ),
        grades: gradeRows.length,
        finalizations: finalizationRows.length,
    };
}

// ========== MAIN ==========
async function main(): Promise<void> {
    if (isProduction && process.env.SEED_ALLOW_PRODUCTION !== "1") {
        throw new Error(
            "Refusing to seed: SYSTEM_STATUS=production. Set SEED_ALLOW_PRODUCTION=1 to override."
        );
    }

    const pool = databasePool();
    const connection = await pool.getConnection();

    try {
        const school = await getTargetSchool(connection);
        console.log(`Seeding into school #${school.school_id} — ${school.school_name}`);

        if (CONFIG.reset) {
            const removed = await deleteSeededStudents(connection, school.school_id);
            console.log(`Reset: removed ${removed} previously seeded student account(s)`);
        }

        const alreadySeeded = await countSeededStudents(connection, school.school_id);
        if (alreadySeeded > 0) {
            console.log(
                `Skipping: ${alreadySeeded} seeded student(s) already exist for this school.` +
                `\nRe-run with --reset to delete them first.`
            );
            return;
        }

        // ---- setup (idempotent, autocommit) ----
        const years = await ensureSchoolYears(connection, school);
        const periodsByYear = new Map<number, PeriodRow[]>();
        for (const year of years) {
            periodsByYear.set(year.id, await ensurePeriods(connection, school, year));
        }
        const subjects = await ensureSubjects(connection, school);
        const neededFaculties = Math.max(6, CONFIG.sections.length * 3);
        const faculties = await ensureFaculties(connection, school, neededFaculties);
        await ensureSubjectFaculties(connection, subjects, faculties);
        const classPlans = await ensureClassPlans(
            connection, school, years, subjects, faculties, periodsByYear
        );

        console.log(
            `Setup: ${years.length} school year(s), ${subjects.length} subject(s), ` +
            `${faculties.length} faculty, ${[...classPlans.values()].flat().length} class(es)`
        );

        // ---- students + records (single transaction) ----
        await connection.beginTransaction();
        try {
            const counts = await seedStudentRecords({
                connection,
                school,
                years,
                periodsByYear,
                classPlans,
                passwordHash: await hashPassword(CONFIG.password),
            });
            await connection.commit();

            console.log("\nSeeding complete:");
            console.log(`  students ............. ${counts.students}`);
            console.log(`  enrollments .......... ${counts.enrollments}`);
            console.log(`  enrollment subjects .. ${counts.enrollmentSubjects}`);
            console.log(`  grade items .......... ${counts.gradeItems}`);
            console.log(`  grades ............... ${counts.grades}`);
            console.log(`  finalizations ........ ${counts.finalizations}`);
            console.log(`\nStudent logins: ${CONFIG.studentEmailPrefix}001@${CONFIG.emailDomain} … ` +
                `${CONFIG.studentEmailPrefix}${String(CONFIG.studentCount).padStart(3, "0")}@${CONFIG.emailDomain}`);
            console.log(`Password for every seeded account: ${CONFIG.password}`);
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    } finally {
        connection.release();
        await pool.end();
    }
}

main()
    .then(() => {
        console.log("\nDone.");
    })
    .catch((err) => {
        console.error("\nSeeding failed:", err);
        process.exit(1);
    });
