CREATE TABLE `retention_operation_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `repo_id` INTEGER NULL,
  `operation` VARCHAR(32) NOT NULL DEFAULT 'retention-cleanup',
  `status` VARCHAR(16) NOT NULL,
  `trigger_source` VARCHAR(16) NOT NULL,
  `dry_run` BOOLEAN NOT NULL DEFAULT TRUE,
  `enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` DATETIME(3) NULL,
  `cutoff_at` DATETIME(3) NULL,
  `hot_runs` INTEGER NOT NULL DEFAULT 0,
  `warm_runs` INTEGER NOT NULL DEFAULT 0,
  `cold_runs` INTEGER NOT NULL DEFAULT 0,
  `eligible_runs` INTEGER NOT NULL DEFAULT 0,
  `deleted_runs` INTEGER NOT NULL DEFAULT 0,
  `preserved_runs` INTEGER NOT NULL DEFAULT 0,
  `details` JSON NULL,
  `error_message` TEXT NULL,
  INDEX `retention_operation_logs_repo_id_started_at_idx`(`repo_id`, `started_at`),
  INDEX `retention_operation_logs_status_started_at_idx`(`status`, `started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `retention_operation_logs` ADD CONSTRAINT `retention_operation_logs_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
