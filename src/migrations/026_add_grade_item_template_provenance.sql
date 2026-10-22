-- Snapshot instructions and provenance for activities created from templates
ALTER TABLE `grade_items`
  ADD COLUMN `instructions` text DEFAULT NULL AFTER `due_date`,
  ADD COLUMN `class_module_id` binary(16) DEFAULT NULL AFTER `instructions`,
  ADD COLUMN `module_template_id` binary(16) DEFAULT NULL AFTER `class_module_id`;

ALTER TABLE `grade_items`
  ADD KEY `idx_gi_class_module` (`class_module_id`),
  ADD KEY `idx_gi_module_template` (`module_template_id`);

ALTER TABLE `grade_items`
  ADD CONSTRAINT `fk_gi_class_module`
    FOREIGN KEY (`class_module_id`) REFERENCES `class_modules` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_gi_module_template`
    FOREIGN KEY (`module_template_id`) REFERENCES `module_activity_templates` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
