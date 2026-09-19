import { computeNormalizedFinalGrade } from "../helper/gradeCalculation.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${testName}`);
    } else {
        failed++;
        console.log(`  ✗ ${testName}${details ? ` — ${details}` : ""}`);
    }
}

function assertEquals(actual: number | null, expected: number | null, testName: string) {
    const match = actual === expected || (actual !== null && expected !== null && Math.abs(actual - expected) < 0.01);
    assert(match, testName, `expected ${expected}, got ${actual}`);
}

// ============================================================
// Weights: Activities=20, Quizzes=30, Exams=40, Attendance=10
// ============================================================
const weights = new Map<string, number>([
    ["activities", 20],
    ["quizzes", 30],
    ["exams", 40],
    ["attendance", 10],
]);

console.log("\n=== Test 1: Only Activities graded ===");
{
    // Activities: 20/20 = 100%, no quizzes, no exams, no attendance records
    const catAvg = new Map<string, number | null>([
        ["activities", 100],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: activities=20, total=20
    // Grade: (100 * 20/20) = 100
    const result = computeNormalizedFinalGrade(catAvg, 0, false, weights);
    assertEquals(result, 100, "100% activities only → 100");
}

console.log("\n=== Test 2: Only Attendance available ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", null],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: attendance=10, total=10
    // Grade: (100 * 10/10) = 100
    const result = computeNormalizedFinalGrade(catAvg, 100, true, weights);
    assertEquals(result, 100, "100% attendance only → 100");
}

console.log("\n=== Test 3: Activities + Attendance graded ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 100],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: activities=20, attendance=10, total=30
    // Grade: (100 * 20/30) + (100 * 10/30) = 100
    const result = computeNormalizedFinalGrade(catAvg, 100, true, weights);
    assertEquals(result, 100, "100% activities + 100% attendance → 100");
}

console.log("\n=== Test 4: All categories graded ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 80],
        ["quizzes", 90],
        ["exams", 70],
    ]);
    // Active weight: activities=20, quizzes=30, exams=40, attendance=10, total=100
    // Grade: (80*20 + 90*30 + 70*40 + 100*10) / 100 = (1600+2700+2800+1000)/100 = 81
    const result = computeNormalizedFinalGrade(catAvg, 100, true, weights);
    assertEquals(result, 81, "80/90/70/100 weighted → 81");
}

console.log("\n=== Test 5: Student with explicit 0 score ===");
{
    // Activities: 0/20 = 0% (explicit score of 0, NOT missing)
    const catAvg = new Map<string, number | null>([
        ["activities", 0],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: activities=20, total=20
    // Grade: (0 * 20/20) = 0
    const result = computeNormalizedFinalGrade(catAvg, 0, false, weights);
    assertEquals(result, 0, "0% activities (explicit) → 0");
}

console.log("\n=== Test 6: Student with no grades at all ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", null],
        ["quizzes", null],
        ["exams", null],
    ]);
    // No active weights → null
    const result = computeNormalizedFinalGrade(catAvg, 0, false, weights);
    assertEquals(result, null, "No data → null");
}

console.log("\n=== Test 7: Attendance exists but 0% (all absent) ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 100],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: activities=20, attendance=10, total=30
    // Grade: (100 * 20/30) + (0 * 10/30) = 66.67
    const result = computeNormalizedFinalGrade(catAvg, 0, true, weights);
    assertEquals(result, 66.67, "100% activities + 0% attendance (records exist) → 66.67");
}

console.log("\n=== Test 8: No attendance records — attendance weight excluded ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 100],
        ["quizzes", null],
        ["exams", null],
    ]);
    // hasAttendance=false → attendance excluded
    // Active weight: activities=20, total=20
    // Grade: (100 * 20/20) = 100
    const result = computeNormalizedFinalGrade(catAvg, 0, false, weights);
    assertEquals(result, 100, "100% activities, no attendance records → 100 (not 20)");
}

console.log("\n=== Test 9: The user's reported bug scenario ===");
{
    // Weights: Activities=20, Quizzes=30, Exams=40, Attendance=10
    // Activity 1: 20/20 = 100%
    // Attendance: 100% (records exist)
    // No quizzes, no exams
    const catAvg = new Map<string, number | null>([
        ["activities", 100],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: activities=20, attendance=10, total=30
    // Grade: (100 * 20/30) + (100 * 10/30) = 100
    const result = computeNormalizedFinalGrade(catAvg, 100, true, weights);
    assertEquals(result, 100, "User bug: 100% act + 100% att (no quiz/exam) → 100 (not 30)");
}

console.log("\n=== Test 10: Mixed — activities 50%, quizzes null, exams 80%, no attendance ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 50],
        ["quizzes", null],
        ["exams", 80],
    ]);
    // Active weight: activities=20, exams=40, total=60
    // Grade: (50 * 20/60) + (80 * 40/60) = 16.67 + 53.33 = 70
    const result = computeNormalizedFinalGrade(catAvg, 0, false, weights);
    assertEquals(result, 70, "50% act + 80% exam (no quiz/att) → 70");
}

console.log("\n=== Test 11: Explicit 0 in one category, grades in others ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 0],
        ["quizzes", 100],
        ["exams", null],
    ]);
    // Active weight: activities=20, quizzes=30, total=50
    // Grade: (0 * 20/50) + (100 * 30/50) = 60
    const result = computeNormalizedFinalGrade(catAvg, 0, false, weights);
    assertEquals(result, 60, "0% act + 100% quiz (no exam/att) → 60");
}

console.log("\n=== Test 12: All zeros ===");
{
    const catAvg = new Map<string, number | null>([
        ["activities", 0],
        ["quizzes", 0],
        ["exams", 0],
    ]);
    // Active weight: all 100, total=100
    // Grade: 0
    const result = computeNormalizedFinalGrade(catAvg, 0, true, weights);
    assertEquals(result, 0, "All 0% → 0");
}

console.log("\n=== Test 13: Unequal weights — only smallest category graded ===");
{
    const smallWeights = new Map<string, number>([
        ["activities", 5],
        ["quizzes", 5],
        ["exams", 80],
        ["attendance", 10],
    ]);
    const catAvg = new Map<string, number | null>([
        ["activities", 100],
        ["quizzes", null],
        ["exams", null],
    ]);
    // Active weight: activities=5, total=5
    // Grade: (100 * 5/5) = 100
    const result = computeNormalizedFinalGrade(catAvg, 0, false, smallWeights);
    assertEquals(result, 100, "Only 5% activities graded → 100 (not 5)");
}

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
    process.exit(1);
}
