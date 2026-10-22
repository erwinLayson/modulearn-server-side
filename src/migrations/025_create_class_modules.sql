-- Module assignments to classrooms for a specific school year
CREATE TABLE IF NOT EXISTS `class_modules` (
  `id` binary(16) NOT NULL,
  `module_id` binary(16) NOT NULL,
  `classroom_id` binary(16) NOT NULL,
  `school_year_id` bigint(20) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_modules` (`module_id`,`classroom_id`,`school_year_id`),
  KEY `idx_cm_class_year` (`classroom_id`,`school_year_id`),
  KEY `idx_cm_module` (`module_id`),
  CONSTRAINT `fk_cm_module`
    FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cm_classroom`
    FOREIGN KEY (`classroom_id`) REFERENCES `classes` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cm_school_year`
    FOREIGN KEY (`school_year_id`) REFERENCES `school_years` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
