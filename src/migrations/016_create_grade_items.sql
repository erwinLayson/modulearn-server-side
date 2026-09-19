CREATE TABLE IF NOT EXISTS grade_items (
    id         BINARY(16)    PRIMARY KEY NOT NULL,
    class_id   BINARY(16)    NOT NULL,
    subject_id BINARY(16)    NOT NULL,
    faculty_id BINARY(16)    NOT NULL,
    category   ENUM('activities','quizzes','exams') NOT NULL,
    title      VARCHAR(255)  NOT NULL,
    max_score  DECIMAL(10,2) NOT NULL,
    due_date   DATE          NULL,
    created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE uq_grade_items (class_id, subject_id, title),
    INDEX idx_grade_items_class_subject (class_id, subject_id)
);
