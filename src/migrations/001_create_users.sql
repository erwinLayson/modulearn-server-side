CREATE TABLE IF NOT EXISTS users (
    id          BINARY(16)    PRIMARY KEY NOT NULL,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,
    role        ENUM('super_admin','school_admin','faculty','student') NOT NULL,
    status      ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
    name        VARCHAR(255)  NULL,
    school_id   BIGINT        NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_school_id (school_id)
);
