CREATE TABLE IF NOT EXISTS school_years (
    id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(50)  NOT NULL,
    start_date DATE         NOT NULL,
    end_date   DATE         NOT NULL,
    school_id  BIGINT       NOT NULL,
    is_current TINYINT(1)   DEFAULT 0,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE unique_school_year_name (name, school_id)
);
