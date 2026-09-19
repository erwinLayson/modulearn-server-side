CREATE TABLE IF NOT EXISTS grades (
    id            BIGINT        PRIMARY KEY AUTO_INCREMENT,
    grade_item_id BINARY(16)    NOT NULL,
    student_id    BINARY(16)    NOT NULL,
    score         DECIMAL(10,2) NOT NULL,
    recorded_by   BINARY(16)    NOT NULL,
    recorded_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE uq_grades (grade_item_id, student_id),
    INDEX idx_grades_student (student_id)
);
