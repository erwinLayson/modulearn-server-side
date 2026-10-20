-- attendance_records
CREATE TABLE IF NOT EXISTS `attendance_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `class_id` binary(16) NOT NULL,
  `student_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `attendance_date` date NOT NULL,
  `status` enum('present','absent') NOT NULL,
  `marked_by` binary(16) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_class_student_subject_date` (`class_id`,`student_id`,`subject_id`,`attendance_date`),
  KEY `fk_attendance_student_id` (`student_id`),
  KEY `fk_attendance_marked_by` (`marked_by`),
  KEY `fk_attendance_subject` (`subject_id`),
  KEY `idx_attendance_class_subject_date` (`class_id`,`subject_id`,`attendance_date`),
  KEY `idx_attendance_date` (`attendance_date`),
  CONSTRAINT `fk_attendance_class_id` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_marked_by` FOREIGN KEY (`marked_by`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
