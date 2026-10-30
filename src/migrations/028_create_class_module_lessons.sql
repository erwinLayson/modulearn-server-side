-- Publishes individual module lessons / learning materials to a specific
-- class-module assignment (class + school year) so enrolled students can
-- access them.
CREATE TABLE IF NOT EXISTS `class_module_lessons` (
  `id` binary(16) NOT NULL,
  `class_module_id` binary(16) NOT NULL,
  `lesson_id` binary(16) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cml_class_lesson` (`class_module_id`,`lesson_id`),
  KEY `idx_cml_lesson` (`lesson_id`),
  CONSTRAINT `fk_cml_class_module`
    FOREIGN KEY (`class_module_id`) REFERENCES `class_modules` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cml_lesson`
    FOREIGN KEY (`lesson_id`) REFERENCES `module_lessons` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
