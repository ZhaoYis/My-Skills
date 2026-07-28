ALTER TABLE `collection_logs`
MODIFY `started_at` DATETIME(3) NULL,
ALTER COLUMN `status` SET DEFAULT 'queued',
ADD COLUMN `queued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
ADD COLUMN `dry_run` BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN `mode` VARCHAR(16) NOT NULL DEFAULT 'trusted',
ADD COLUMN `trigger_source` VARCHAR(16) NOT NULL DEFAULT 'manual',
ADD COLUMN `worker_id` VARCHAR(64) NULL,
ADD COLUMN `attempt` INTEGER NOT NULL DEFAULT 1,
ADD COLUMN `retry_of_id` BIGINT NULL,
ADD COLUMN `cancel_requested_at` DATETIME(3) NULL,
ADD COLUMN `cancelled_at` DATETIME(3) NULL;

CREATE INDEX `collection_logs_status_queued_at_idx`
ON `collection_logs`(`status`, `queued_at`);

CREATE INDEX `collection_logs_retry_of_id_idx`
ON `collection_logs`(`retry_of_id`);
