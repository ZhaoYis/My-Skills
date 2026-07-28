ALTER TABLE `repos`
  ADD COLUMN `scan_from_commit` CHAR(40) NULL,
  ADD COLUMN `scan_to_commit` CHAR(40) NULL,
  ADD COLUMN `last_relevant_commit` CHAR(40) NULL,
  ADD COLUMN `checkpoint_policy` VARCHAR(32) NOT NULL DEFAULT 'advance-record-rejections';

ALTER TABLE `collection_logs`
  ADD COLUMN `scan_from_commit` CHAR(40) NULL,
  ADD COLUMN `scan_to_commit` CHAR(40) NULL,
  ADD COLUMN `last_relevant_commit` CHAR(40) NULL,
  ADD COLUMN `batch_size` INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN `batches_total` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `batches_completed` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `heartbeat_at` DATETIME(3) NULL,
  ADD COLUMN `checkpoint_policy` VARCHAR(32) NOT NULL DEFAULT 'advance-record-rejections',
  ADD COLUMN `error_category` VARCHAR(32) NULL,
  ADD COLUMN `transaction_retries` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `force_push_detected` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `collection_logs_status_heartbeat_at_idx` ON `collection_logs`(`status`, `heartbeat_at`);
