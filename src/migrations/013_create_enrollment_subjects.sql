CREATE TABLE IF NOT EXISTS enrollment_subjects (
    id            BIGINT     PRIMARY KEY AUTO_INCREMENT,
    enrollment_id BINARY(16) NOT NULL,
    subject_id    BINARY(16) NOT NULL,
    created_at    TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    UNIQUE unique_enrollment_subject (enrollment_id, subject_id)
);
