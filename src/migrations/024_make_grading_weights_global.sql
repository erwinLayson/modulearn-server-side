-- 024: make grading weights global - exactly one row per class_id + subject_id + category
-- Case C guard: fails with Duplicate entry on uq_grading_weights when conflicting
-- period-specific weights exist with no global row - resolve those manually first
-- NOTE - the migration runner splits statements on semicolons, so comments and strings must never contain one

INSERT INTO grading_weights (class_id, subject_id, category, period_id, weight, created_at)
SELECT gw.class_id, gw.subject_id, gw.category, gw.period_id, gw.weight, gw.created_at
FROM grading_weights gw
JOIN (
  SELECT class_id, subject_id, category
  FROM grading_weights
  WHERE period_id IS NOT NULL
  GROUP BY class_id, subject_id, category
  HAVING COUNT(DISTINCT weight) > 1
) d ON d.class_id = gw.class_id AND d.subject_id = gw.subject_id AND d.category = gw.category
WHERE gw.period_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM grading_weights g
    WHERE g.class_id = gw.class_id AND g.subject_id = gw.subject_id
      AND g.category = gw.category AND g.period_id IS NULL
  );

-- Case B: keys with no global row - promote lowest id to global
UPDATE grading_weights gw
JOIN (
  SELECT class_id, subject_id, category, MIN(id) AS keep_id
  FROM grading_weights
  GROUP BY class_id, subject_id, category
  HAVING SUM(period_id IS NULL) = 0
) d ON d.class_id = gw.class_id AND d.subject_id = gw.subject_id AND d.category = gw.category
SET gw.period_id = NULL
WHERE gw.id = d.keep_id;

-- Case A cleanup: every key now has a global row - remove remaining period-specific rows
DELETE FROM grading_weights WHERE period_id IS NOT NULL;

-- Standalone class index so fk_grading_weights_class survives dropping the old unique key
ALTER TABLE grading_weights ADD KEY IF NOT EXISTS gw_class_idx (class_id);

ALTER TABLE grading_weights DROP FOREIGN KEY IF EXISTS fk_gw_period;

ALTER TABLE grading_weights DROP INDEX IF EXISTS uq_grading_weights;

ALTER TABLE grading_weights DROP COLUMN IF EXISTS period_id;

ALTER TABLE grading_weights ADD UNIQUE KEY IF NOT EXISTS uq_grading_weights (class_id, subject_id, category);
