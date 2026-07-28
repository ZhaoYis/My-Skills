ALTER TABLE `repos` ADD COLUMN `deleted_at` DATETIME(3) NULL;

CREATE INDEX `repos_deleted_at_idx` ON `repos`(`deleted_at`);
