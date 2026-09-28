-- 026: historical snapshots on enrollments and enrollment_subjects
-- Display authority for academic records is the snapshot - live master data is fallback only

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS class_name_snapshot VARCHAR(255) NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS section_snapshot VARCHAR(50) NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS adviser_name_snapshot VARCHAR(255) NULL;
ALTER TABLE enrollment_subjects ADD COLUMN IF NOT EXISTS subject_name_snapshot VARCHAR(255) NULL;

UPDATE enrollments e
INNER JOIN classes c ON c.id = e.class_id
LEFT JOIN faculties f ON f.id = c.faculty_id
SET e.class_name_snapshot = COALESCE(e.class_name_snapshot, c.class_name),
    e.section_snapshot = COALESCE(e.section_snapshot, c.section),
    e.adviser_name_snapshot = COALESCE(e.adviser_name_snapshot, CONCAT(f.first_name, ' ', f.last_name))
WHERE e.class_name_snapshot IS NULL;

UPDATE enrollment_subjects es
INNER JOIN subjects s ON s.id = es.subject_id
SET es.subject_name_snapshot = COALESCE(es.subject_name_snapshot, s.name)
WHERE es.subject_name_snapshot IS NULL;
