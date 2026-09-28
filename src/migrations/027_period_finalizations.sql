-- 027: period finalizations - frozen official final grades
-- period_id NULL means year-end finalization
-- Runner splits on semicolons - no semicolons inside comments or strings

CREATE TABLE IF NOT EXISTS period_finalizations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    school_id BIGINT NOT NULL,
    school_year_id BIGINT NOT NULL,
    period_id BIGINT NULL,
    class_id BINARY(16) NOT NULL,
    subject_id BINARY(16) NOT NULL,
    student_id BINARY(16) NOT NULL,
    final_grade DECIMAL(5,2) NULL,
    finalized_by BINARY(16) NOT NULL,
    finalized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BINARY(16) NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    correction_reason VARCHAR(500) NULL,

    UNIQUE KEY uq_period_finalizations (period_id, class_id, subject_id, student_id),
    INDEX idx_pf_student (student_id),
    INDEX idx_pf_class_subject (class_id, subject_id),

    CONSTRAINT fk_pf_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
    CONSTRAINT fk_pf_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pf_period FOREIGN KEY (period_id) REFERENCES academic_periods(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pf_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pf_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pf_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_pf_finalized_by FOREIGN KEY (finalized_by) REFERENCES users(id) ON DELETE RESTRICT
);
