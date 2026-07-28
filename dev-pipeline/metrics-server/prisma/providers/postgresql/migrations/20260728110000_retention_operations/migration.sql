CREATE TABLE "retention_operation_logs" (
  "id" BIGSERIAL NOT NULL,
  "repo_id" INTEGER,
  "operation" VARCHAR(32) NOT NULL DEFAULT 'retention-cleanup',
  "status" VARCHAR(16) NOT NULL,
  "trigger_source" VARCHAR(16) NOT NULL,
  "dry_run" BOOLEAN NOT NULL DEFAULT TRUE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "cutoff_at" TIMESTAMP(3),
  "hot_runs" INTEGER NOT NULL DEFAULT 0,
  "warm_runs" INTEGER NOT NULL DEFAULT 0,
  "cold_runs" INTEGER NOT NULL DEFAULT 0,
  "eligible_runs" INTEGER NOT NULL DEFAULT 0,
  "deleted_runs" INTEGER NOT NULL DEFAULT 0,
  "preserved_runs" INTEGER NOT NULL DEFAULT 0,
  "details" JSONB,
  "error_message" TEXT,
  CONSTRAINT "retention_operation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "retention_operation_logs_repo_id_started_at_idx" ON "retention_operation_logs"("repo_id", "started_at");
CREATE INDEX "retention_operation_logs_status_started_at_idx" ON "retention_operation_logs"("status", "started_at");
ALTER TABLE "retention_operation_logs" ADD CONSTRAINT "retention_operation_logs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
