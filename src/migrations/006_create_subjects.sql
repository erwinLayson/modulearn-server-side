CREATE TABLE IF NOT EXISTS subjects (
    id            BINARY(16)    PRIMARY KEY NOT NULL,
    name          VARCHAR(255)  NOT NULL,
    subject_code  VARCHAR(50)   DEFAULT NULL,
    description   TEXT          DEFAULT NULL,
    school_id     BIGINT        NOT NULL,
    admin_id      BINARY(16)    NOT NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE uq_subjects_name_school (name, school_id),
    INDEX idx_subjects_school_id (school_id)
);
