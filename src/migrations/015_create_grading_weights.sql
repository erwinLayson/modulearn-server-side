CREATE TABLE IF NOT EXISTS grading_weights (
    id         BIGINT                          PRIMARY KEY AUTO_INCREMENT,
    class_id   BINARY(16)                      NOT NULL,
    subject_id BINARY(16)                      NOT NULL,
    category   ENUM('activities','quizzes','exams','attendance') NOT NULL,
    weight     DECIMAL(5,2)                    NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP                       DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP                       NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE uq_grading_weights (class_id, subject_id, category)
);
