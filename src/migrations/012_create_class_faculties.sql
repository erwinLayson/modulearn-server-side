-- class_faculties
CREATE TABLE IF NOT EXISTS `class_faculties` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `class_id` binary(16) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `school_year_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_class_faculty_subject_year` (`class_id`,`faculty_id`,`subject_id`,`school_year_id`),
  KEY `fk_class_faculties_school_year_id` (`school_year_id`),
  KEY `fk_class_faculties_subject` (`subject_id`),
  KEY `fk_class_faculties_faculty_id` (`faculty_id`),
  CONSTRAINT `fk_class_faculties_class_id` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_class_faculties_faculty_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_class_faculties_school_year_id` FOREIGN KEY (`school_year_id`) REFERENCES `school_years` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_class_faculties_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
