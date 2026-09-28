/**
 * Catalog of system features the super admin can switch off per school.
 *
 * Adding a feature here is enough for it to appear in the super admin UI.
 * It also needs to be enforced: `requireFeature("<key>")` on the API routes
 * and a `feature` tag on the sidebar/route on the client.
 */
export const FEATURE_KEYS = [
    "attendance",
    "attendance_reports",
    "gradebook",
    "academic_record",
    "enrollments",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureDefinition {
    key: FeatureKey;
    label: string;
    description: string;
}

export const FEATURES: FeatureDefinition[] = [
    {
        key: "attendance",
        label: "Attendance",
        description: "Faculty attendance marking, class attendance spreadsheets and student attendance views",
    },
    {
        key: "attendance_reports",
        label: "Classroom attendance reports",
        description: "School-wide attendance history, the monthly matrix and its Excel export",
    },
    {
        key: "gradebook",
        label: "Gradebook",
        description: "Grading weights, grade items, scores, period finalization and student grades",
    },
    {
        key: "academic_record",
        label: "Student academic record",
        description: "Print-ready historical record of a student's grades across school years",
    },
    {
        key: "enrollments",
        label: "Enrollments",
        description: "Enrolling students into classes, dropping them and removing them from a class",
    },
];

export const FEATURE_LABELS = Object.fromEntries(
    FEATURES.map(feature => [feature.key, feature.label])
) as Record<FeatureKey, string>;

export function isFeatureKey(value: string): value is FeatureKey {
    return (FEATURE_KEYS as readonly string[]).includes(value);
}
