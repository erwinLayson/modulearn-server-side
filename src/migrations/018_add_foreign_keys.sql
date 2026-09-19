-- Foreign Key Constraints
-- Added separately to handle circular dependencies between
-- users, school_admins, and schools

-- school_admins → users
ALTER TABLE school_admins
    ADD CONSTRAINT fk_school_admins_user_id
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- schools → school_admins
ALTER TABLE schools
    ADD CONSTRAINT fk_admin_id
    FOREIGN KEY (admin_id) REFERENCES school_admins(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- users → schools
ALTER TABLE users
    ADD CONSTRAINT fk_users_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- school_admins → schools
ALTER TABLE school_admins
    ADD CONSTRAINT fk_school_admins_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- faculties → users
ALTER TABLE faculties
    ADD CONSTRAINT fk_faculties_user_id
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- faculties → schools
ALTER TABLE faculties
    ADD CONSTRAINT fk_faculties_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- students → users
ALTER TABLE students
    ADD CONSTRAINT fk_students_user_id
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- students → schools
ALTER TABLE students
    ADD CONSTRAINT fk_students_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- subjects → schools
ALTER TABLE subjects
    ADD CONSTRAINT fk_subjects_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- modules → subjects
ALTER TABLE modules
    ADD CONSTRAINT fk_modules_subject_id
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- modules → schools
ALTER TABLE modules
    ADD CONSTRAINT fk_modules_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- school_years → schools
ALTER TABLE school_years
    ADD CONSTRAINT fk_school_years_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- classes → faculties
ALTER TABLE classes
    ADD CONSTRAINT fk_classes_faculty_id
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- classes → schools
ALTER TABLE classes
    ADD CONSTRAINT fk_classes_school_id
    FOREIGN KEY (school_id) REFERENCES schools(school_id);

-- enrollments → students
ALTER TABLE enrollments
    ADD CONSTRAINT fk_enrollments_student_id
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- enrollments → classes
ALTER TABLE enrollments
    ADD CONSTRAINT fk_enrollments_class_id
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- enrollments → school_years
ALTER TABLE enrollments
    ADD CONSTRAINT fk_enrollments_school_year
    FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL;

-- subject_faculties → subjects
ALTER TABLE subject_faculties
    ADD CONSTRAINT fk_subject_faculties_subject_id
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- subject_faculties → faculties
ALTER TABLE subject_faculties
    ADD CONSTRAINT fk_subject_faculties_faculty_id
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- class_faculties → classes
ALTER TABLE class_faculties
    ADD CONSTRAINT fk_class_faculties_class_id
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- class_faculties → faculties
ALTER TABLE class_faculties
    ADD CONSTRAINT fk_class_faculties_faculty_id
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- class_faculties → subjects
ALTER TABLE class_faculties
    ADD CONSTRAINT fk_class_faculties_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- enrollment_subjects → enrollments
ALTER TABLE enrollment_subjects
    ADD CONSTRAINT fk_enrollment_subjects_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;

-- enrollment_subjects → subjects
ALTER TABLE enrollment_subjects
    ADD CONSTRAINT fk_enrollment_subjects_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;

-- attendance_records → classes
ALTER TABLE attendance_records
    ADD CONSTRAINT fk_attendance_class_id
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- attendance_records → students
ALTER TABLE attendance_records
    ADD CONSTRAINT fk_attendance_student_id
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- attendance_records → subjects
ALTER TABLE attendance_records
    ADD CONSTRAINT fk_attendance_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;

-- attendance_records → faculties
ALTER TABLE attendance_records
    ADD CONSTRAINT fk_attendance_marked_by
    FOREIGN KEY (marked_by) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grading_weights → classes
ALTER TABLE grading_weights
    ADD CONSTRAINT fk_grading_weights_class
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grading_weights → subjects
ALTER TABLE grading_weights
    ADD CONSTRAINT fk_grading_weights_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grade_items → classes
ALTER TABLE grade_items
    ADD CONSTRAINT fk_grade_items_class
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grade_items → subjects
ALTER TABLE grade_items
    ADD CONSTRAINT fk_grade_items_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grade_items → faculties
ALTER TABLE grade_items
    ADD CONSTRAINT fk_grade_items_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grades → grade_items
ALTER TABLE grades
    ADD CONSTRAINT fk_grades_grade_item
    FOREIGN KEY (grade_item_id) REFERENCES grade_items(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grades → students
ALTER TABLE grades
    ADD CONSTRAINT fk_grades_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- grades → faculties
ALTER TABLE grades
    ADD CONSTRAINT fk_grades_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE;
