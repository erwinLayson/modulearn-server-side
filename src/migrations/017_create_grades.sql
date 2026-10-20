-- grades
CREATE TABLE IF NOT EXISTS `grades` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `grade_item_id` binary(16) NOT NULL,
  `student_id` binary(16) NOT NULL,
  `score` decimal(10,2) NOT NULL,
  `recorded_by` binary(16) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grades` (`grade_item_id`,`student_id`),
  KEY `idx_grades_student` (`student_id`),
  KEY `fk_grades_recorded_by` (`recorded_by`),
  CONSTRAINT `fk_grades_grade_item` FOREIGN KEY (`grade_item_id`) REFERENCES `grade_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_grades_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `faculties` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_grades_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
