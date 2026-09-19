CREATE TABLE IF NOT EXISTS schools (
    id             BINARY(16)    PRIMARY KEY,
    school_id      BIGINT        NOT NULL,
    school_name    VARCHAR(255)  NOT NULL,
    school_level   INT           NOT NULL,
    school_email   VARCHAR(255)  NOT NULL UNIQUE,
    address        VARCHAR(255)  NOT NULL,
    region         VARCHAR(255)  NOT NULL,
    province       VARCHAR(255)  NOT NULL,
    city           VARCHAR(255)  NOT NULL,
    contact_number VARCHAR(255)  NOT NULL,
    school_logo    VARCHAR(255)  NOT NULL,
    school_admin   VARCHAR(255)  NOT NULL,
    admin_id       BINARY(16)    NOT NULL,
    registered_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_schools_school_id (school_id)
);
