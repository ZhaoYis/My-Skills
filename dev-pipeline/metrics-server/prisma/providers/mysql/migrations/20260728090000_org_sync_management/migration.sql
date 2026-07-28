ALTER TABLE `sync_logs`
  ADD COLUMN `adapter` VARCHAR(32) NULL,
  ADD COLUMN `trigger_source` VARCHAR(32) NOT NULL DEFAULT 'upload',
  ADD COLUMN `attempt` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `retry_of_id` BIGINT NULL,
  ADD COLUMN `canonical_snapshot` JSON NULL,
  ADD COLUMN `error_category` VARCHAR(32) NULL;

CREATE INDEX `sync_logs_started_at_idx` ON `sync_logs`(`started_at`);
CREATE INDEX `sync_logs_retry_of_id_idx` ON `sync_logs`(`retry_of_id`);
