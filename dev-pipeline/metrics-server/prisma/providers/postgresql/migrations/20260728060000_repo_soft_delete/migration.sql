ALTER TABLE "repos" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "repos_deleted_at_idx" ON "repos"("deleted_at");
