CREATE TABLE IF NOT EXISTS school_admins (
    id          BINARY(16)    PRIMARY KEY NOT NULL,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    school_id   BIGINT        NOT NULL,
    password    VARCHAR(255)  NOT NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_admins_school_id (school_id)
);
