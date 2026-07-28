ALTER TABLE "teams"
  ADD COLUMN "sync_source" VARCHAR(32),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivated_at" TIMESTAMP(3);

ALTER TABLE "developers"
  ADD COLUMN "sync_source" VARCHAR(32),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivated_at" TIMESTAMP(3);

ALTER TABLE "sync_logs"
  ADD COLUMN "dry_run" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "teams_moved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "teams_deactivated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "devs_created" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "devs_updated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "devs_moved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "devs_unassigned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "devs_deactivated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failures" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "teams_sync_source_is_active_idx" ON "teams"("sync_source", "is_active");
CREATE INDEX "developers_sync_source_is_active_idx" ON "developers"("sync_source", "is_active");
