-- Fresh schema build: create the tracking table first and defer foreign key checks
-- so tables can be created before the tables they reference (handles the
-- users -> schools -> school_admins -> users cycle).
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS migrations (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    filename    VARCHAR(255)  NOT NULL UNIQUE,
    executed_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
