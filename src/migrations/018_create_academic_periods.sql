-- academic_periods
CREATE TABLE IF NOT EXISTS `academic_periods` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `school_id` bigint(20) NOT NULL,
  `school_year_id` bigint(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `period_number` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ap_school_year_name` (`school_id`,`school_year_id`,`name`),
  UNIQUE KEY `uq_ap_school_year_number` (`school_id`,`school_year_id`,`period_number`),
  KEY `idx_ap_school_year` (`school_id`,`school_year_id`),
  KEY `fk_ap_school_year` (`school_year_id`),
  CONSTRAINT `fk_ap_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ap_school_year` FOREIGN KEY (`school_year_id`) REFERENCES `school_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
