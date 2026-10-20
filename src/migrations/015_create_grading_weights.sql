-- grading_weights
CREATE TABLE IF NOT EXISTS `grading_weights` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `class_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `category` enum('activities','quizzes','exams','attendance') NOT NULL,
  `weight` decimal(5,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grading_weights` (`class_id`,`subject_id`,`category`),
  KEY `fk_grading_weights_subject` (`subject_id`),
  KEY `gw_class_idx` (`class_id`),
  CONSTRAINT `fk_grading_weights_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_grading_weights_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
