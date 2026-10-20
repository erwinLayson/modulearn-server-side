-- subject_faculties
CREATE TABLE IF NOT EXISTS `subject_faculties` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `subject_id` binary(16) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subject_faculty` (`subject_id`,`faculty_id`),
  KEY `fk_subject_faculties_faculty_id` (`faculty_id`),
  CONSTRAINT `fk_subject_faculties_faculty_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_subject_faculties_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
