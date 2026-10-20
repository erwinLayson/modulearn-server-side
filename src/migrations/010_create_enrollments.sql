-- enrollments
CREATE TABLE IF NOT EXISTS `enrollments` (
  `id` binary(16) NOT NULL,
  `student_id` binary(16) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `school_year_id` bigint(20) DEFAULT NULL,
  `grade_level` int(11) DEFAULT NULL,
  `enrolled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('active','dropped','completed','transferred') NOT NULL DEFAULT 'active',
  `class_name_snapshot` varchar(255) DEFAULT NULL,
  `section_snapshot` varchar(50) DEFAULT NULL,
  `adviser_name_snapshot` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_enrollments_student_id` (`student_id`),
  KEY `fk_enrollments_class_id` (`class_id`),
  KEY `fk_enrollments_school_year` (`school_year_id`),
  CONSTRAINT `fk_enrollments_class_id` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_enrollments_school_year` FOREIGN KEY (`school_year_id`) REFERENCES `school_years` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_enrollments_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
