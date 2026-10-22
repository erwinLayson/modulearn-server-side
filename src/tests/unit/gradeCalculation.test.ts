import { describe, expect, it } from "vitest";
import { computeNormalizedFinalGrade } from "../../helper/gradeCalculation.js";

// Weights: Activities=20, Quizzes=30, Exams=40, Attendance=10
const WEIGHTS = new Map<string, number>([
    ["activities", 20],
    ["quizzes", 30],
    ["exams", 40],
    ["attendance", 10],
]);

const grade = (
    averages: [string, number | null][],
    attendanceRate = 0,
    hasAttendance = false,
    weights: Map<string, number> = WEIGHTS
) => computeNormalizedFinalGrade(new Map(averages), attendanceRate, hasAttendance, weights);

describe("computeNormalizedFinalGrade", () => {
    it("scores 100 when only activities are graded", () => {
        // Active weight: activities=20, total=20 → 100 * 20/20
        expect(grade([["activities", 100], ["quizzes", null], ["exams", null]])).toBe(100);
    });

    it("scores 100 when only attendance is available", () => {
        // Active weight: attendance=10, total=10 → 100 * 10/10
        expect(
            grade([["activities", null], ["quizzes", null], ["exams", null]], 100, true)
        ).toBe(100);
    });

    it("scores 100 when activities and attendance are graded", () => {
        // Active weight: 20 + 10 = 30
        expect(
            grade([["activities", 100], ["quizzes", null], ["exams", null]], 100, true)
        ).toBe(100);
    });

    it("applies the configured weights when every category is graded", () => {
        // (80*20 + 90*30 + 70*40 + 100*10) / 100 = 81
        expect(
            grade([["activities", 80], ["quizzes", 90], ["exams", 70]], 100, true)
        ).toBe(81);
    });

    it("counts an explicit zero score as real data", () => {
        // (0 * 20/20) = 0, not "missing"
        expect(grade([["activities", 0], ["quizzes", null], ["exams", null]])).toBe(0);
    });

    it("returns null when there is no data at all", () => {
        expect(
            grade([["activities", null], ["quizzes", null], ["exams", null]], 0, false)
        ).toBeNull();
    });

    it("counts 0% attendance when attendance records exist", () => {
        // (100 * 20/30) + (0 * 10/30) = 66.67
        expect(
            grade([["activities", 100], ["quizzes", null], ["exams", null]], 0, true)
        ).toBe(66.67);
    });

    it("excludes attendance when no attendance records exist", () => {
        // (100 * 20/20) = 100, not 20
        expect(
            grade([["activities", 100], ["quizzes", null], ["exams", null]], 0, false)
        ).toBe(100);
    });

    it("does not shrink the grade when quiz and exam data are missing", () => {
        // Regression for the reported bug: 100% activities + 100% attendance → 100, not 30
        expect(
            grade([["activities", 100], ["quizzes", null], ["exams", null]], 100, true)
        ).toBe(100);
    });

    it("renormalizes over the graded categories only", () => {
        // (50*20 + 80*40) / 60 = 70
        expect(
            grade([["activities", 50], ["quizzes", null], ["exams", 80]], 0, false)
        ).toBe(70);
    });

    it("mixes an explicit zero with graded categories", () => {
        // (0*20 + 100*30) / 50 = 60
        expect(
            grade([["activities", 0], ["quizzes", 100], ["exams", null]], 0, false)
        ).toBe(60);
    });

    it("scores 0 when every category is explicitly zero", () => {
        expect(grade([["activities", 0], ["quizzes", 0], ["exams", 0]], 0, true)).toBe(0);
    });

    it("ignores raw weight sizes and normalizes to the active categories", () => {
        const smallWeights = new Map<string, number>([
            ["activities", 5],
            ["quizzes", 5],
            ["exams", 80],
            ["attendance", 10],
        ]);

        expect(
            grade([["activities", 100], ["quizzes", null], ["exams", null]], 0, false, smallWeights)
        ).toBe(100);
    });

    it("returns null when every active weight is zero", () => {
        const zeroWeights = new Map<string, number>([
            ["activities", 0],
            ["quizzes", 0],
            ["exams", 0],
            ["attendance", 0],
        ]);

        expect(
            grade([["activities", 100], ["quizzes", null], ["exams", null]], 0, false, zeroWeights)
        ).toBeNull();
    });

    it("rounds the final grade to two decimals", () => {
        const equalWeights = new Map<string, number>([
            ["activities", 1],
            ["quizzes", 1],
            ["exams", 1],
            ["attendance", 10],
        ]);

        // (50 + 50 + 0) / 3 = 33.333...
        expect(
            grade([["activities", 50], ["quizzes", 50], ["exams", 0]], 0, false, equalWeights)
        ).toBe(33.33);
    });

    it("treats a category missing from the weight map as weight 0", () => {
        const examsOnly = new Map<string, number>([["exams", 100]]);

        // activities has data but no weight: (80 * 100/100) = 80
        expect(
            grade([["activities", 50], ["quizzes", null], ["exams", 80]], 0, false, examsOnly)
        ).toBe(80);
    });

    it("uses the attendance rate, not a category average named attendance", () => {
        // attendance in the category map is skipped; hasAttendance/rate drive the value
        // (100 * 20/30) + (40 * 10/30) = 80; using the category value 80 would give 93.33
        expect(
            grade([["activities", 100], ["attendance", 80]], 40, true)
        ).toBe(80);
    });
});
