-- school_admins
CREATE TABLE IF NOT EXISTS `school_admins` (
  `id` binary(16) NOT NULL,
  `email` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_school_admins_email_school` (`email`,`school_id`),
  KEY `idx_school_admins_school_id` (`school_id`),
  CONSTRAINT `fk_school_admins_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  CONSTRAINT `fk_school_admins_user_id` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
