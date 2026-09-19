CREATE TABLE IF NOT EXISTS classes (
    id           BINARY(16)    PRIMARY KEY NOT NULL,
    class_name   VARCHAR(255)  NOT NULL,
    school_id    BIGINT        NOT NULL,
    faculty_id   BINARY(16)    NOT NULL,
    capacity     INT           NULL,
    section      VARCHAR(50)   NULL,
    grade_level  VARCHAR(50)   NULL,
    schedule     JSON          NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE unique_class_adviser (faculty_id),
    INDEX idx_classes_school_id (school_id)
);
