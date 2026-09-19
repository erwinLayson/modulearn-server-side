CREATE TABLE IF NOT EXISTS class_faculties (
    id         BIGINT     PRIMARY KEY AUTO_INCREMENT,
    class_id   BINARY(16) NOT NULL,
    faculty_id BINARY(16) NOT NULL,
    subject_id BINARY(16) NULL,
    created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    UNIQUE unique_class_faculty_subject (class_id, faculty_id, subject_id)
);
