-- enrollment_subjects
CREATE TABLE IF NOT EXISTS `enrollment_subjects` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `enrollment_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `subject_name_snapshot` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_enrollment_subject` (`enrollment_id`,`subject_id`),
  KEY `fk_enrollment_subjects_subject` (`subject_id`),
  CONSTRAINT `fk_enrollment_subjects_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_subjects_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
