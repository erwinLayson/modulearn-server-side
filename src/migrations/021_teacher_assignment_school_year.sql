-- Add school_year_id to classes table for per-year adviser tracking

-- Step 1: Add nullable column (skip if already exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'school_year_id');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE classes ADD COLUMN school_year_id BIGINT NULL AFTER school_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: Backfill with current school year for each school
UPDATE classes c
INNER JOIN school_years sy ON sy.school_id = c.school_id AND sy.is_current = 1
SET c.school_year_id = sy.id
WHERE c.school_year_id IS NULL;

-- Step 3: Drop FK that depends on the old unique index (skip if already dropped)
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND CONSTRAINT_NAME = 'fk_classes_faculty_id');
SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE classes DROP FOREIGN KEY fk_classes_faculty_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: Drop old unique index (skip if already dropped)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND INDEX_NAME = 'unique_class_adviser');
SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE classes DROP INDEX unique_class_adviser',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 5: Add new per-year unique constraint (skip if already exists)
SET @new_idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND INDEX_NAME = 'unique_class_adviser_year');
SET @sql = IF(@new_idx = 0,
    'ALTER TABLE classes ADD UNIQUE unique_class_adviser_year (faculty_id, school_year_id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 6: Re-add the FK
SET @fk_readd = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND CONSTRAINT_NAME = 'fk_classes_faculty_id');
SET @sql = IF(@fk_readd = 0,
    'ALTER TABLE classes ADD CONSTRAINT fk_classes_faculty_id FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 7: Make school_year_id NOT NULL
ALTER TABLE classes MODIFY COLUMN school_year_id BIGINT NOT NULL;

-- Step 8: Add foreign key for school_year_id (skip if already exists)
SET @sy_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND CONSTRAINT_NAME = 'fk_classes_school_year_id');
SET @sql = IF(@sy_fk = 0,
    'ALTER TABLE classes ADD CONSTRAINT fk_classes_school_year_id FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON UPDATE CASCADE ON DELETE RESTRICT',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- Add school_year_id to class_faculties table for per-year teaching tracking

-- Step 1: Add nullable column (skip if already exists)
SET @col_exists2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND COLUMN_NAME = 'school_year_id');
SET @sql = IF(@col_exists2 = 0,
    'ALTER TABLE class_faculties ADD COLUMN school_year_id BIGINT NULL AFTER subject_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: Backfill from parent class's school_year_id
UPDATE class_faculties cf
INNER JOIN classes c ON c.id = cf.class_id
SET cf.school_year_id = c.school_year_id
WHERE cf.school_year_id IS NULL;

-- Step 3: Drop old unique constraint (skip if already dropped)
SET @old_idx2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND INDEX_NAME = 'unique_class_faculty_subject');
SET @sql = IF(@old_idx2 > 0,
    'ALTER TABLE class_faculties DROP INDEX unique_class_faculty_subject',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: Add new per-year unique constraint (skip if already exists)
SET @new_idx2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND INDEX_NAME = 'unique_class_faculty_subject_year');
SET @sql = IF(@new_idx2 = 0,
    'ALTER TABLE class_faculties ADD UNIQUE unique_class_faculty_subject_year (class_id, faculty_id, subject_id, school_year_id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 5: Make school_year_id NOT NULL
ALTER TABLE class_faculties MODIFY COLUMN school_year_id BIGINT NOT NULL;

-- Step 6: Add foreign key (skip if already exists)
SET @sy_fk2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND CONSTRAINT_NAME = 'fk_class_faculties_school_year_id');
SET @sql = IF(@sy_fk2 = 0,
    'ALTER TABLE class_faculties ADD CONSTRAINT fk_class_faculties_school_year_id FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON UPDATE CASCADE ON DELETE RESTRICT',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
