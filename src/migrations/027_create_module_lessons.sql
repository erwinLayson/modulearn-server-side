-- Lessons belonging to teaching modules (written notes or uploaded document files)
CREATE TABLE IF NOT EXISTS `module_lessons` (
  `id` binary(16) NOT NULL,
  `module_id` binary(16) NOT NULL,
  `title` varchar(255) NOT NULL,
  `lesson_type` enum('text','file') NOT NULL DEFAULT 'text',
  `content` longtext DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_type` varchar(100) DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ml_module_sort` (`module_id`,`sort_order`),
  CONSTRAINT `fk_ml_module`
    FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Migrate any existing lesson_content into module_lessons
INSERT INTO `module_lessons` (`id`, `module_id`, `title`, `lesson_type`, `content`, `sort_order`)
SELECT 
  UNHEX(REPLACE(UUID(), '-', '')),
  `id`,
  'Overview Lesson',
  'text',
  `lesson_content`,
  0
FROM `modules`
WHERE `lesson_content` IS NOT NULL AND TRIM(`lesson_content`) != ''
  AND NOT EXISTS (
    SELECT 1 FROM `module_lessons` WHERE `module_lessons`.`module_id` = `modules`.`id`
  );
