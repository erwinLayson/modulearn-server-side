-- attendance_sessions
CREATE TABLE IF NOT EXISTS `attendance_sessions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `class_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `attendance_date` date NOT NULL,
  `period_id` bigint(20) NOT NULL,
  `created_by` binary(16) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_sessions` (`class_id`,`subject_id`,`attendance_date`),
  KEY `idx_as_period` (`period_id`),
  KEY `fk_as_subject` (`subject_id`),
  KEY `fk_as_creator` (`created_by`),
  CONSTRAINT `fk_as_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_as_creator` FOREIGN KEY (`created_by`) REFERENCES `faculties` (`id`),
  CONSTRAINT `fk_as_period` FOREIGN KEY (`period_id`) REFERENCES `academic_periods` (`id`),
  CONSTRAINT `fk_as_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
