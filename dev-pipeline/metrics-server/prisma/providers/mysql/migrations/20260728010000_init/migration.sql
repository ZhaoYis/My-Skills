-- CreateTable
CREATE TABLE `teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `slug` VARCHAR(128) NOT NULL,
    `parent_id` INTEGER NULL,
    `external_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `teams_slug_key`(`slug`),
    UNIQUE INDEX `teams_external_id_key`(`external_id`),
    INDEX `teams_parent_id_idx`(`parent_id`),
    INDEX `teams_external_id_idx`(`external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `developers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NULL,
    `role` VARCHAR(16) NULL,
    `team_id` INTEGER NULL,
    `external_id` VARCHAR(255) NULL,
    `first_seen_at` DATETIME(3) NOT NULL,
    `last_seen_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `developers_email_key`(`email`),
    UNIQUE INDEX `developers_external_id_key`(`external_id`),
    INDEX `developers_email_idx`(`email`),
    INDEX `developers_team_id_idx`(`team_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `git_url` VARCHAR(512) NOT NULL,
    `git_branch` VARCHAR(255) NOT NULL DEFAULT 'main',
    `collect_since` DATETIME(3) NOT NULL,
    `last_fetched_commit` CHAR(40) NULL,
    `last_fetched_at` DATETIME(3) NULL,
    `collection_status` VARCHAR(16) NOT NULL DEFAULT 'idle',
    `collection_started_at` DATETIME(3) NULL,
    `collection_error` TEXT NULL,
    `retention_days` INTEGER NOT NULL DEFAULT 365,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `repos_collection_status_is_active_idx`(`collection_status`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pipeline_runs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `repo_id` INTEGER NOT NULL,
    `developer_id` INTEGER NULL,
    `change_name` VARCHAR(128) NOT NULL,
    `schema_version` INTEGER NOT NULL DEFAULT 3,
    `state_version` INTEGER NOT NULL,
    `source_branch` VARCHAR(255) NOT NULL,
    `target_branch` VARCHAR(255) NULL,
    `current_phase` INTEGER NOT NULL,
    `current_step` INTEGER NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `execution_mode` VARCHAR(16) NOT NULL,
    `is_latest` BOOLEAN NOT NULL DEFAULT true,
    `fingerprint_id` VARCHAR(512) NOT NULL,
    `fingerprint_nonce` CHAR(8) NOT NULL,
    `fingerprint_verified` BOOLEAN NOT NULL DEFAULT false,
    `fingerprint_key_version` VARCHAR(16) NULL,
    `created_by_email` VARCHAR(255) NOT NULL,
    `created_by` VARCHAR(128) NOT NULL,
    `created_at_source` DATETIME(3) NOT NULL,
    `machine_platform` VARCHAR(64) NULL,
    `machine_hostname` VARCHAR(255) NULL,
    `machine_os_release` VARCHAR(64) NULL,
    `machine_node_version` VARCHAR(32) NULL,
    `machine_arch` VARCHAR(16) NULL,
    `feature_id` VARCHAR(255) NULL,
    `feature_url` VARCHAR(1024) NULL,
    `archive_path` VARCHAR(512) NULL,
    `pause_reason` VARCHAR(255) NULL,
    `delivery_commit_sha` CHAR(40) NULL,
    `delivery_merge_commit_sha` CHAR(40) NULL,
    `delivery_source_pushed` BOOLEAN NOT NULL DEFAULT false,
    `delivery_target_pushed` BOOLEAN NOT NULL DEFAULT false,
    `delivery_tag` VARCHAR(255) NULL,
    `review_status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `review_current_round` INTEGER NOT NULL DEFAULT 0,
    `tests_command` VARCHAR(1024) NULL,
    `tests_attempts` INTEGER NOT NULL DEFAULT 0,
    `tests_status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `tests_detail` TEXT NULL,
    `verify_command` VARCHAR(1024) NULL,
    `verify_attempts` INTEGER NOT NULL DEFAULT 0,
    `verify_status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `verify_detail` TEXT NULL,
    `created_at_pipeline` DATETIME(3) NOT NULL,
    `updated_at_pipeline` DATETIME(3) NOT NULL,
    `change_duration_seconds` INTEGER NULL,
    `content_hash` CHAR(32) NOT NULL,
    `raw_state_json` JSON NULL,
    `commit_sha` CHAR(40) NOT NULL,
    `commit_timestamp` DATETIME(3) NOT NULL,
    `extracted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pipeline_runs_repo_id_idx`(`repo_id`),
    INDEX `pipeline_runs_developer_id_idx`(`developer_id`),
    INDEX `pipeline_runs_is_latest_idx`(`is_latest`),
    INDEX `pipeline_runs_fingerprint_id_idx`(`fingerprint_id`),
    INDEX `pipeline_runs_fingerprint_verified_idx`(`fingerprint_verified`),
    INDEX `pipeline_runs_status_idx`(`status`),
    INDEX `pipeline_runs_commit_sha_idx`(`commit_sha`),
    INDEX `pipeline_runs_created_at_pipeline_idx`(`created_at_pipeline`),
    INDEX `pipeline_runs_repo_id_change_name_idx`(`repo_id`, `change_name`),
    UNIQUE INDEX `pipeline_runs_repo_id_change_name_content_hash_key`(`repo_id`, `change_name`, `content_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phase_history_entries` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `run_id` BIGINT NOT NULL,
    `phase` INTEGER NOT NULL,
    `step` INTEGER NOT NULL,
    `executed_by` VARCHAR(128) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `duration_seconds` INTEGER NULL,

    INDEX `phase_history_entries_run_id_idx`(`run_id`),
    INDEX `phase_history_entries_phase_idx`(`phase`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_rounds` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `run_id` BIGINT NOT NULL,
    `round_number` INTEGER NOT NULL,
    `report_path` VARCHAR(512) NULL,
    `status` VARCHAR(16) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `review_rounds_run_id_round_number_key`(`run_id`, `round_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pipeline_decisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `run_id` BIGINT NOT NULL,
    `decision_key` VARCHAR(64) NOT NULL,
    `decision_value` JSON NOT NULL,

    UNIQUE INDEX `pipeline_decisions_run_id_decision_key_key`(`run_id`, `decision_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pipeline_gates_bypassed` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `run_id` BIGINT NOT NULL,
    `gate_name` VARCHAR(128) NOT NULL,

    INDEX `pipeline_gates_bypassed_run_id_idx`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phase_entry_decisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phase_entry_id` BIGINT NOT NULL,
    `decision_key` VARCHAR(64) NOT NULL,
    `decision_value` JSON NOT NULL,

    UNIQUE INDEX `phase_entry_decisions_phase_entry_id_decision_key_key`(`phase_entry_id`, `decision_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phase_entry_gates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phase_entry_id` BIGINT NOT NULL,
    `gate_name` VARCHAR(128) NOT NULL,

    INDEX `phase_entry_gates_phase_entry_id_idx`(`phase_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_round_decisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `review_round_id` BIGINT NOT NULL,
    `decision_key` VARCHAR(64) NOT NULL,
    `decision_value` JSON NOT NULL,

    UNIQUE INDEX `review_round_decisions_review_round_id_decision_key_key`(`review_round_id`, `decision_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `repo_id` INTEGER NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `finished_at` DATETIME(3) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'running',
    `commits_scanned` INTEGER NOT NULL DEFAULT 0,
    `files_found` INTEGER NOT NULL DEFAULT 0,
    `runs_upserted` INTEGER NOT NULL DEFAULT 0,
    `runs_skipped` INTEGER NOT NULL DEFAULT 0,
    `fingerprints_rejected` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,

    INDEX `collection_logs_repo_id_idx`(`repo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `source` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'running',
    `started_at` DATETIME(3) NOT NULL,
    `finished_at` DATETIME(3) NULL,
    `teams_created` INTEGER NOT NULL DEFAULT 0,
    `teams_updated` INTEGER NOT NULL DEFAULT 0,
    `devs_linked` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,

    INDEX `sync_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `developers` ADD CONSTRAINT `developers_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pipeline_runs` ADD CONSTRAINT `pipeline_runs_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pipeline_runs` ADD CONSTRAINT `pipeline_runs_developer_id_fkey` FOREIGN KEY (`developer_id`) REFERENCES `developers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_history_entries` ADD CONSTRAINT `phase_history_entries_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_rounds` ADD CONSTRAINT `review_rounds_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pipeline_decisions` ADD CONSTRAINT `pipeline_decisions_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pipeline_gates_bypassed` ADD CONSTRAINT `pipeline_gates_bypassed_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `pipeline_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_entry_decisions` ADD CONSTRAINT `phase_entry_decisions_phase_entry_id_fkey` FOREIGN KEY (`phase_entry_id`) REFERENCES `phase_history_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_entry_gates` ADD CONSTRAINT `phase_entry_gates_phase_entry_id_fkey` FOREIGN KEY (`phase_entry_id`) REFERENCES `phase_history_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_round_decisions` ADD CONSTRAINT `review_round_decisions_review_round_id_fkey` FOREIGN KEY (`review_round_id`) REFERENCES `review_rounds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_logs` ADD CONSTRAINT `collection_logs_repo_id_fkey` FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
