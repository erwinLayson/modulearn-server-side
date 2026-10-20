-- faculties
CREATE TABLE IF NOT EXISTS `faculties` (
  `id` binary(16) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `contact_number` varchar(255) DEFAULT NULL,
  `faculty_role` enum('teacher','cashier','register') NOT NULL DEFAULT 'teacher',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_faculties_email_school` (`email`,`school_id`),
  KEY `idx_faculties_school_id` (`school_id`),
  CONSTRAINT `fk_faculties_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  CONSTRAINT `fk_faculties_user_id` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
