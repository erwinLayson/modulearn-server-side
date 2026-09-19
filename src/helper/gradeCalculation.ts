/**
 * Compute final grade using normalized weights.
 *
 * Only categories with available data participate. Their raw weights are
 * normalized so that they sum to 100% across active categories only.
 *
 * Rules:
 * - A category with no graded items (average = null) is excluded entirely.
 * - Attendance is excluded when no attendance records exist (hasAttendance = false).
 * - An actual recorded score of 0 IS valid data and participates in the calculation.
 * - If no category has any data, returns null.
 *
 * @param categoryAverages  Map of category -> percentage (null = no graded items)
 * @param attendanceRate    Attendance percentage (only used when hasAttendance is true)
 * @param hasAttendance     Whether any attendance records exist for this student
 * @param weightMap         Map of category -> raw weight (0-100)
 * @returns Final grade (0-100) rounded to 2 decimals, or null if no data at all
 */
export function computeNormalizedFinalGrade(
    categoryAverages: Map<string, number | null>,
    attendanceRate: number,
    hasAttendance: boolean,
    weightMap: Map<string, number>
): number | null {
    const activeWeights: { category: string; weight: number }[] = [];

    for (const [cat, avg] of categoryAverages) {
        if (cat === "attendance") continue;
        if (avg !== null) {
            activeWeights.push({ category: cat, weight: weightMap.get(cat) || 0 });
        }
    }

    if (hasAttendance) {
        activeWeights.push({ category: "attendance", weight: weightMap.get("attendance") || 0 });
    }

    const totalActiveWeight = activeWeights.reduce((sum, w) => sum + w.weight, 0);
    if (totalActiveWeight === 0) return null;

    let finalGrade = 0;
    for (const { category, weight } of activeWeights) {
        if (category === "attendance") {
            finalGrade += attendanceRate * (weight / totalActiveWeight);
        } else {
            finalGrade += (categoryAverages.get(category) || 0) * (weight / totalActiveWeight);
        }
    }

    return Math.round(finalGrade * 100) / 100;
}
