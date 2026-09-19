CREATE TABLE IF NOT EXISTS subject_faculties (
    id         BIGINT     PRIMARY KEY AUTO_INCREMENT,
    subject_id BINARY(16) NOT NULL,
    faculty_id BINARY(16) NOT NULL,
    created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    UNIQUE uq_subject_faculty (subject_id, faculty_id)
);
