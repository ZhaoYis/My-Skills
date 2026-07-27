-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "parent_id" INTEGER,
    "external_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developers" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "role" VARCHAR(16),
    "team_id" INTEGER,
    "external_id" VARCHAR(255),
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repos" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "git_url" VARCHAR(512) NOT NULL,
    "git_branch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "collect_since" TIMESTAMP(3) NOT NULL,
    "last_fetched_commit" CHAR(40),
    "last_fetched_at" TIMESTAMP(3),
    "collection_status" VARCHAR(16) NOT NULL DEFAULT 'idle',
    "collection_started_at" TIMESTAMP(3),
    "collection_error" TEXT,
    "retention_days" INTEGER NOT NULL DEFAULT 365,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" BIGSERIAL NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "developer_id" INTEGER,
    "change_name" VARCHAR(128) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 3,
    "state_version" INTEGER NOT NULL,
    "source_branch" VARCHAR(255) NOT NULL,
    "target_branch" VARCHAR(255),
    "current_phase" INTEGER NOT NULL,
    "current_step" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "execution_mode" VARCHAR(16) NOT NULL,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "fingerprint_id" VARCHAR(512) NOT NULL,
    "fingerprint_nonce" CHAR(8) NOT NULL,
    "fingerprint_verified" BOOLEAN NOT NULL DEFAULT false,
    "fingerprint_key_version" VARCHAR(16),
    "created_by_email" VARCHAR(255) NOT NULL,
    "created_by" VARCHAR(128) NOT NULL,
    "created_at_source" TIMESTAMP(3) NOT NULL,
    "machine_platform" VARCHAR(64),
    "machine_hostname" VARCHAR(255),
    "machine_os_release" VARCHAR(64),
    "machine_node_version" VARCHAR(32),
    "machine_arch" VARCHAR(16),
    "feature_id" VARCHAR(255),
    "feature_url" VARCHAR(1024),
    "archive_path" VARCHAR(512),
    "pause_reason" VARCHAR(255),
    "delivery_commit_sha" CHAR(40),
    "delivery_merge_commit_sha" CHAR(40),
    "delivery_source_pushed" BOOLEAN NOT NULL DEFAULT false,
    "delivery_target_pushed" BOOLEAN NOT NULL DEFAULT false,
    "delivery_tag" VARCHAR(255),
    "review_status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "review_current_round" INTEGER NOT NULL DEFAULT 0,
    "tests_command" VARCHAR(1024),
    "tests_attempts" INTEGER NOT NULL DEFAULT 0,
    "tests_status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "tests_detail" TEXT,
    "verify_command" VARCHAR(1024),
    "verify_attempts" INTEGER NOT NULL DEFAULT 0,
    "verify_status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "verify_detail" TEXT,
    "created_at_pipeline" TIMESTAMP(3) NOT NULL,
    "updated_at_pipeline" TIMESTAMP(3) NOT NULL,
    "change_duration_seconds" INTEGER,
    "content_hash" CHAR(32) NOT NULL,
    "raw_state_json" JSONB,
    "commit_sha" CHAR(40) NOT NULL,
    "commit_timestamp" TIMESTAMP(3) NOT NULL,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_history_entries" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "phase" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "executed_by" VARCHAR(128) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,

    CONSTRAINT "phase_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_rounds" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "report_path" VARCHAR(512),
    "status" VARCHAR(16) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_decisions" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "decision_key" VARCHAR(64) NOT NULL,
    "decision_value" JSONB NOT NULL,

    CONSTRAINT "pipeline_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_gates_bypassed" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "gate_name" VARCHAR(128) NOT NULL,

    CONSTRAINT "pipeline_gates_bypassed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_entry_decisions" (
    "id" BIGSERIAL NOT NULL,
    "phase_entry_id" BIGINT NOT NULL,
    "decision_key" VARCHAR(64) NOT NULL,
    "decision_value" JSONB NOT NULL,

    CONSTRAINT "phase_entry_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_entry_gates" (
    "id" BIGSERIAL NOT NULL,
    "phase_entry_id" BIGINT NOT NULL,
    "gate_name" VARCHAR(128) NOT NULL,

    CONSTRAINT "phase_entry_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_round_decisions" (
    "id" BIGSERIAL NOT NULL,
    "review_round_id" BIGINT NOT NULL,
    "decision_key" VARCHAR(64) NOT NULL,
    "decision_value" JSONB NOT NULL,

    CONSTRAINT "review_round_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_logs" (
    "id" BIGSERIAL NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'running',
    "commits_scanned" INTEGER NOT NULL DEFAULT 0,
    "files_found" INTEGER NOT NULL DEFAULT 0,
    "runs_upserted" INTEGER NOT NULL DEFAULT 0,
    "runs_skipped" INTEGER NOT NULL DEFAULT 0,
    "fingerprints_rejected" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "collection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" BIGSERIAL NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "teams_created" INTEGER NOT NULL DEFAULT 0,
    "teams_updated" INTEGER NOT NULL DEFAULT 0,
    "devs_linked" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "teams_external_id_key" ON "teams"("external_id");

-- CreateIndex
CREATE INDEX "teams_parent_id_idx" ON "teams"("parent_id");

-- CreateIndex
CREATE INDEX "teams_external_id_idx" ON "teams"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "developers_email_key" ON "developers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "developers_external_id_key" ON "developers"("external_id");

-- CreateIndex
CREATE INDEX "developers_email_idx" ON "developers"("email");

-- CreateIndex
CREATE INDEX "developers_team_id_idx" ON "developers"("team_id");

-- CreateIndex
CREATE INDEX "repos_collection_status_is_active_idx" ON "repos"("collection_status", "is_active");

-- CreateIndex
CREATE INDEX "pipeline_runs_repo_id_idx" ON "pipeline_runs"("repo_id");

-- CreateIndex
CREATE INDEX "pipeline_runs_developer_id_idx" ON "pipeline_runs"("developer_id");

-- CreateIndex
CREATE INDEX "pipeline_runs_is_latest_idx" ON "pipeline_runs"("is_latest");

-- CreateIndex
CREATE INDEX "pipeline_runs_fingerprint_id_idx" ON "pipeline_runs"("fingerprint_id");

-- CreateIndex
CREATE INDEX "pipeline_runs_fingerprint_verified_idx" ON "pipeline_runs"("fingerprint_verified");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs"("status");

-- CreateIndex
CREATE INDEX "pipeline_runs_commit_sha_idx" ON "pipeline_runs"("commit_sha");

-- CreateIndex
CREATE INDEX "pipeline_runs_created_at_pipeline_idx" ON "pipeline_runs"("created_at_pipeline");

-- CreateIndex
CREATE INDEX "pipeline_runs_repo_id_change_name_idx" ON "pipeline_runs"("repo_id", "change_name");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_runs_repo_id_change_name_content_hash_key" ON "pipeline_runs"("repo_id", "change_name", "content_hash");

-- CreateIndex
CREATE INDEX "phase_history_entries_run_id_idx" ON "phase_history_entries"("run_id");

-- CreateIndex
CREATE INDEX "phase_history_entries_phase_idx" ON "phase_history_entries"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "review_rounds_run_id_round_number_key" ON "review_rounds"("run_id", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_decisions_run_id_decision_key_key" ON "pipeline_decisions"("run_id", "decision_key");

-- CreateIndex
CREATE INDEX "pipeline_gates_bypassed_run_id_idx" ON "pipeline_gates_bypassed"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "phase_entry_decisions_phase_entry_id_decision_key_key" ON "phase_entry_decisions"("phase_entry_id", "decision_key");

-- CreateIndex
CREATE INDEX "phase_entry_gates_phase_entry_id_idx" ON "phase_entry_gates"("phase_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_round_decisions_review_round_id_decision_key_key" ON "review_round_decisions"("review_round_id", "decision_key");

-- CreateIndex
CREATE INDEX "collection_logs_repo_id_idx" ON "collection_logs"("repo_id");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developers" ADD CONSTRAINT "developers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_history_entries" ADD CONSTRAINT "phase_history_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_rounds" ADD CONSTRAINT "review_rounds_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_decisions" ADD CONSTRAINT "pipeline_decisions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_gates_bypassed" ADD CONSTRAINT "pipeline_gates_bypassed_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_entry_decisions" ADD CONSTRAINT "phase_entry_decisions_phase_entry_id_fkey" FOREIGN KEY ("phase_entry_id") REFERENCES "phase_history_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_entry_gates" ADD CONSTRAINT "phase_entry_gates_phase_entry_id_fkey" FOREIGN KEY ("phase_entry_id") REFERENCES "phase_history_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_round_decisions" ADD CONSTRAINT "review_round_decisions_review_round_id_fkey" FOREIGN KEY ("review_round_id") REFERENCES "review_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_logs" ADD CONSTRAINT "collection_logs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
