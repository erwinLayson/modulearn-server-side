-- 028: per-school feature switches controlled by the super admin
-- Opt-out model: a missing row means the feature is enabled
-- Runner splits statements on semicolons - no semicolons inside comments or strings

CREATE TABLE IF NOT EXISTS school_features (
    id          BIGINT      PRIMARY KEY AUTO_INCREMENT,
    school_id   BIGINT      NOT NULL,
    feature_key VARCHAR(64) NOT NULL,
    is_enabled  TINYINT(1)  NOT NULL DEFAULT 1,
    updated_by  BINARY(16)  NULL,
    created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP   NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_school_feature (school_id, feature_key),
    INDEX idx_school_features_school (school_id),
    CONSTRAINT fk_school_features_school
        FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);
