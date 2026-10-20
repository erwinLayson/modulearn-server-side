-- classes
CREATE TABLE IF NOT EXISTS `classes` (
  `id` binary(16) NOT NULL,
  `class_name` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `school_year_id` bigint(20) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `capacity` int(11) DEFAULT NULL,
  `section` varchar(50) DEFAULT NULL,
  `grade_level` varchar(50) DEFAULT NULL,
  `schedule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`schedule`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_class_adviser_year` (`faculty_id`,`school_year_id`),
  KEY `idx_classes_school_id` (`school_id`),
  KEY `fk_classes_school_year_id` (`school_year_id`),
  CONSTRAINT `fk_classes_faculty_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_classes_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  CONSTRAINT `fk_classes_school_year_id` FOREIGN KEY (`school_year_id`) REFERENCES `school_years` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
