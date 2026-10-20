-- modules
CREATE TABLE IF NOT EXISTS `modules` (
  `id` binary(16) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL,
  `subject_id` binary(16) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_modules_subject_id` (`subject_id`),
  KEY `idx_modules_school_id` (`school_id`),
  CONSTRAINT `fk_modules_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  CONSTRAINT `fk_modules_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
