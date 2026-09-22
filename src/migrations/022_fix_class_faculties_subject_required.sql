-- Fix: Make subject_id NOT NULL in class_faculties and strengthen unique constraint
-- MySQL unique indexes treat NULL as distinct, so duplicate rows with NULL subject_id
-- can exist. Every faculty-class assignment should have a subject (adviser is tracked in classes table).

-- Step 1: Drop the existing unique constraint that allows NULLs
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND INDEX_NAME = 'unique_class_faculty_subject_year');
SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE class_faculties DROP INDEX unique_class_faculty_subject_year',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: Drop the FK that requires subject_id to be nullable (ON DELETE SET NULL)
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND CONSTRAINT_NAME = 'fk_class_faculties_subject');
SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE class_faculties DROP FOREIGN KEY fk_class_faculties_subject',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2b: Remove any existing rows with NULL subject_id (invalid data)
DELETE FROM class_faculties WHERE subject_id IS NULL;

-- Step 3: Make subject_id NOT NULL
ALTER TABLE class_faculties MODIFY COLUMN subject_id BINARY(16) NOT NULL;

-- Step 4: Recreate the FK with RESTRICT (subject can no longer be nulled out)
SET @fk_recreate = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND CONSTRAINT_NAME = 'fk_class_faculties_subject');
SET @sql = IF(@fk_recreate = 0,
    'ALTER TABLE class_faculties ADD CONSTRAINT fk_class_faculties_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 5: Recreate the unique constraint (now that subject_id is NOT NULL, it will properly prevent duplicates)
SET @idx_recreate = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_faculties' AND INDEX_NAME = 'unique_class_faculty_subject_year');
SET @sql = IF(@idx_recreate = 0,
    'ALTER TABLE class_faculties ADD UNIQUE unique_class_faculty_subject_year (class_id, faculty_id, subject_id, school_year_id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
