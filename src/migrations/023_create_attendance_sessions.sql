CREATE TABLE IF NOT EXISTS attendance_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    class_id BINARY(16) NOT NULL,
    subject_id BINARY(16) NOT NULL,
    attendance_date DATE NOT NULL,
    period_id BIGINT NOT NULL,
    created_by BINARY(16) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_attendance_sessions (
        class_id,
        subject_id,
        attendance_date
    ),

    INDEX idx_as_period (period_id),

    CONSTRAINT fk_as_period
        FOREIGN KEY (period_id)
        REFERENCES academic_periods(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_as_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_as_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_as_creator
        FOREIGN KEY (created_by)
        REFERENCES faculties(id)
        ON DELETE RESTRICT
);
