ALTER TABLE `pipeline_runs` ADD COLUMN `completed_at_pipeline` DATETIME(3) NULL;

UPDATE `pipeline_runs` AS run
JOIN (
  SELECT `repo_id`, `change_name`, MIN(`updated_at_pipeline`) AS `first_completed_at`
  FROM `pipeline_runs`
  WHERE `status` = 'completed'
  GROUP BY `repo_id`, `change_name`
) AS completed
  ON run.`repo_id` = completed.`repo_id` AND run.`change_name` = completed.`change_name`
SET run.`completed_at_pipeline` = completed.`first_completed_at`
WHERE run.`status` = 'completed';

UPDATE `pipeline_runs` SET `change_duration_seconds` = NULL WHERE `status` <> 'completed';

CREATE INDEX `pipeline_runs_completed_at_pipeline_idx` ON `pipeline_runs`(`completed_at_pipeline`);
