-- Separate the trusted latest chain from the historical latest snapshot.
ALTER TABLE `pipeline_runs`
ADD COLUMN `is_latest_historical` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `snapshot_source` VARCHAR(16) NOT NULL DEFAULT 'collector';

UPDATE `pipeline_runs` SET `is_latest_historical` = `is_latest`;
UPDATE `pipeline_runs`
SET `snapshot_source` = 'history-import', `is_latest` = false
WHERE `fingerprint_verified` = false;

ALTER TABLE `collection_logs` ADD COLUMN `rejection_details` JSON NULL;

CREATE INDEX `pipeline_runs_repo_id_change_name_is_latest_historical_idx`
ON `pipeline_runs`(`repo_id`, `change_name`, `is_latest_historical`);
CREATE INDEX `pipeline_runs_snapshot_source_idx` ON `pipeline_runs`(`snapshot_source`);
