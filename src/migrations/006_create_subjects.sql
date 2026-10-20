-- subjects
CREATE TABLE IF NOT EXISTS `subjects` (
  `id` binary(16) NOT NULL,
  `name` varchar(255) NOT NULL,
  `subject_code` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `school_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subjects_name_school` (`name`,`school_id`),
  KEY `idx_subjects_school_id` (`school_id`),
  CONSTRAINT `fk_subjects_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
