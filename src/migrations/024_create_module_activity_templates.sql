-- Reusable activity templates belonging to teaching modules
CREATE TABLE IF NOT EXISTS `module_activity_templates` (
  `id` binary(16) NOT NULL,
  `module_id` binary(16) NOT NULL,
  `title` varchar(255) NOT NULL,
  `instructions` text DEFAULT NULL,
  `category` enum('activities','quizzes','exams') NOT NULL DEFAULT 'activities',
  `max_score` decimal(10,2) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mat_module_sort` (`module_id`,`sort_order`),
  CONSTRAINT `fk_mat_module`
    FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
