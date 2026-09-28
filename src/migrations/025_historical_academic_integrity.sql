-- 025: protect historical academic data
-- Soft-delete columns + enrollment transferred status + RESTRICT FKs for academic history
-- Runner splits on semicolons - no semicolons inside comments or strings

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE faculties ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE enrollments MODIFY COLUMN status ENUM('active','dropped','completed','transferred') NOT NULL DEFAULT 'active';

ALTER TABLE enrollment_subjects DROP FOREIGN KEY IF EXISTS fk_enrollment_subjects_subject;
ALTER TABLE enrollment_subjects ADD CONSTRAINT fk_enrollment_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE enrollments DROP FOREIGN KEY IF EXISTS fk_enrollments_class_id;
ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE enrollments DROP FOREIGN KEY IF EXISTS fk_enrollments_school_year;
ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE grade_items DROP FOREIGN KEY IF EXISTS fk_grade_items_subject;
ALTER TABLE grade_items ADD CONSTRAINT fk_grade_items_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE grade_items DROP FOREIGN KEY IF EXISTS fk_grade_items_class;
ALTER TABLE grade_items ADD CONSTRAINT fk_grade_items_class FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE grade_items DROP FOREIGN KEY IF EXISTS fk_grade_items_faculty;
ALTER TABLE grade_items ADD CONSTRAINT fk_grade_items_faculty FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE grades DROP FOREIGN KEY IF EXISTS fk_grades_recorded_by;
ALTER TABLE grades ADD CONSTRAINT fk_grades_recorded_by FOREIGN KEY (recorded_by) REFERENCES faculties(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE classes DROP FOREIGN KEY IF EXISTS fk_classes_faculty_id;
ALTER TABLE classes ADD CONSTRAINT fk_classes_faculty_id FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE class_faculties DROP FOREIGN KEY IF EXISTS fk_class_faculties_faculty_id;
ALTER TABLE class_faculties ADD CONSTRAINT fk_class_faculties_faculty_id FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON UPDATE CASCADE ON DELETE RESTRICT;
