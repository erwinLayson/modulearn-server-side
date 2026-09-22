-- ============================================================
-- Phase 1: Academic Period Configuration
-- ============================================================

-- 1a. Alter schools table — add academic configuration columns
ALTER TABLE schools
    ADD COLUMN academic_system ENUM('quarter','semester') NOT NULL DEFAULT 'quarter' AFTER school_level,
    ADD COLUMN period_count INT NOT NULL DEFAULT 4 AFTER academic_system,
    ADD COLUMN academic_config_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER period_count;

-- 1b. Create academic_periods table
CREATE TABLE IF NOT EXISTS academic_periods (
    id             BIGINT PRIMARY KEY AUTO_INCREMENT,
    school_id      BIGINT NOT NULL,
    school_year_id BIGINT NOT NULL,
    name           VARCHAR(50) NOT NULL,
    period_number  INT NOT NULL,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    is_current     TINYINT(1) NOT NULL DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_ap_school_year_name (school_id, school_year_id, name),
    UNIQUE KEY uq_ap_school_year_number (school_id, school_year_id, period_number),
    INDEX idx_ap_school_year (school_id, school_year_id)
);

-- 1c. Add foreign keys for academic_periods
ALTER TABLE academic_periods
    ADD CONSTRAINT fk_ap_school
        FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_ap_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE;

-- 1d. Alter grading_weights — add period_id
ALTER TABLE grading_weights
    ADD COLUMN period_id BIGINT NULL AFTER subject_id;

ALTER TABLE grading_weights
    DROP INDEX uq_grading_weights,
    ADD UNIQUE uq_grading_weights (class_id, subject_id, category, period_id);

ALTER TABLE grading_weights
    ADD CONSTRAINT fk_gw_period
        FOREIGN KEY (period_id) REFERENCES academic_periods(id) ON DELETE RESTRICT;

-- 1e. Alter grade_items — add period_id
ALTER TABLE grade_items
    ADD COLUMN period_id BIGINT NULL AFTER subject_id;

ALTER TABLE grade_items
    ADD CONSTRAINT fk_gi_period
        FOREIGN KEY (period_id) REFERENCES academic_periods(id) ON DELETE RESTRICT;
