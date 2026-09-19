CREATE TABLE IF NOT EXISTS faculties (
    id             BINARY(16)    PRIMARY KEY NOT NULL,
    first_name     VARCHAR(255)  NOT NULL,
    last_name      VARCHAR(255)  NOT NULL,
    email          VARCHAR(255)  NOT NULL UNIQUE,
    password       VARCHAR(255)  NOT NULL,
    school_id      BIGINT        NOT NULL,
    contact_number VARCHAR(255)  DEFAULT NULL,
    faculty_role   ENUM('teacher','cashier','register') NOT NULL DEFAULT 'teacher',
    admin_id       BINARY(16)    NOT NULL,
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_faculties_school_id (school_id)
);
