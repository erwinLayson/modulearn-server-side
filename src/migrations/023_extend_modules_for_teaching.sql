-- Extend modules for teacher-owned reusable teaching modules
ALTER TABLE `modules`
  ADD COLUMN `owner_faculty_id` binary(16) DEFAULT NULL AFTER `admin_id`,
  ADD COLUMN `status` enum('draft','published','archived') NOT NULL DEFAULT 'published' AFTER `owner_faculty_id`,
  ADD COLUMN `lesson_content` longtext DEFAULT NULL AFTER `status`;

ALTER TABLE `modules`
  MODIFY COLUMN `admin_id` binary(16) DEFAULT NULL;

ALTER TABLE `modules`
  ADD KEY `idx_modules_owner_status` (`owner_faculty_id`,`status`);

ALTER TABLE `modules`
  ADD CONSTRAINT `fk_modules_owner_faculty`
  FOREIGN KEY (`owner_faculty_id`) REFERENCES `faculties` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
