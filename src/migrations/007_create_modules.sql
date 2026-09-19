CREATE TABLE IF NOT EXISTS modules (
    id          BINARY(16)    PRIMARY KEY NOT NULL,
    title       VARCHAR(255)  NOT NULL,
    description TEXT          DEFAULT NULL,
    subject     VARCHAR(255)  NOT NULL,
    school_id   BIGINT        NOT NULL,
    admin_id    BINARY(16)    NOT NULL,
    subject_id  BINARY(16)    NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_modules_school_id (school_id)
);
