-- ============================================================
-- Phase 20: Allow Duplicate Emails Across Different Schools
-- ============================================================
-- Rule: Same email + different school = ALLOWED
--        Same email + same school = REJECTED
-- Auth table: users (UNIQUE on email + school_id is authoritative)
-- Profile tables: students, faculties, school_admins (denormalized email copies)

-- Step 1: Drop global UNIQUE(email) from all 4 tables
--         Constraint name is "email" on all tables (from inline UNIQUE definition)
ALTER TABLE users DROP INDEX email;
ALTER TABLE faculties DROP INDEX email;
ALTER TABLE students DROP INDEX email;
ALTER TABLE school_admins DROP INDEX email;

-- Step 2: Add composite UNIQUE(email, school_id)
--         Enforces one-account-per-email-per-school at the auth level
ALTER TABLE users ADD UNIQUE uq_users_email_school (email, school_id);
ALTER TABLE faculties ADD UNIQUE uq_faculties_email_school (email, school_id);
ALTER TABLE students ADD UNIQUE uq_students_email_school (email, school_id);
ALTER TABLE school_admins ADD UNIQUE uq_school_admins_email_school (email, school_id);
