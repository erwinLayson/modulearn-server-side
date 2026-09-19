CREATE TABLE IF NOT EXISTS enrollments (
    id             BINARY(16)   PRIMARY KEY NOT NULL,
    student_id     BINARY(16)   NOT NULL,
    class_id       BINARY(16)   NOT NULL,
    school_year_id BIGINT       NULL,
    grade_level    INT          NULL,
    enrolled_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    status         ENUM('active','dropped','completed') NOT NULL DEFAULT 'active'
);
