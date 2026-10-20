-- grade_items
CREATE TABLE IF NOT EXISTS `grade_items` (
  `id` binary(16) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `period_id` bigint(20) DEFAULT NULL,
  `faculty_id` binary(16) NOT NULL,
  `category` enum('activities','quizzes','exams') NOT NULL,
  `title` varchar(255) NOT NULL,
  `max_score` decimal(10,2) NOT NULL,
  `due_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grade_items` (`class_id`,`subject_id`,`title`),
  KEY `idx_grade_items_class_subject` (`class_id`,`subject_id`),
  KEY `fk_gi_period` (`period_id`),
  KEY `fk_grade_items_subject` (`subject_id`),
  KEY `fk_grade_items_faculty` (`faculty_id`),
  CONSTRAINT `fk_gi_period` FOREIGN KEY (`period_id`) REFERENCES `academic_periods` (`id`),
  CONSTRAINT `fk_grade_items_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_grade_items_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_grade_items_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
