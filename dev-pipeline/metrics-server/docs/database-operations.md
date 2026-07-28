# Database operations

The server supports PostgreSQL 16+ and MySQL 8.4+. Migration artifacts are isolated under `prisma/providers/<provider>/migrations`; every Prisma command validates `DB_PROVIDER`, `DATABASE_URL`, and `migration_lock.toml` before invoking Prisma.

## Initialize

1. Create an empty database and a least-privilege application/migration account.
2. Set a matching pair:

   ```dotenv
   DB_PROVIDER=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/opsx_metrics
   ```

   or:

   ```dotenv
   DB_PROVIDER=mysql
   DATABASE_URL=mysql://user:password@host:3306/opsx_metrics
   ```

3. Run `npm ci`, `npm run prisma:validate`, `npm run prisma:generate`, and `npm run prisma:migrate`.
4. Run `npm run prisma:verify-db`; the deploy reports the exact current set of 14 application tables.

## Upgrade

1. Back up the database and record the application version and provider.
2. Review only `prisma/providers/$DB_PROVIDER/migrations` and its provider marker.
3. Run `npm run prisma:validate` in the release artifact.
4. Run `npm run prisma:migrate`, deploy the compatible server, then run smoke and integration checks.
5. Never copy `_prisma_migrations` state or SQL from the other provider.

## Rollback

Prisma Migrate uses forward migrations. Before upgrade, take a provider-native backup (`pg_dump`/`pg_restore` for PostgreSQL or `mysqldump`/`mysql` for MySQL). To roll back an incompatible release, stop writers, restore that backup to a new database, point the previous application release at it, and verify readiness. For a data-preserving correction, create and review a new forward migration instead of editing an applied migration.

## Switch providers

A provider switch is a data migration, not a connection-string edit:

1. Stop collectors and organization synchronization, then snapshot the source database.
2. Deploy the target provider migrations into an empty target database.
3. Export and transform application rows while preserving IDs, timestamps, JSON values, and foreign-key order.
4. Reset target sequences/auto-increment counters, compare row counts and trusted-latest invariants, then run the full DB integration suite.
5. Change both `DB_PROVIDER` and `DATABASE_URL`, regenerate Prisma Client, and deploy.
6. Keep the source read-only until post-cutover validation and the rollback window complete.

Changing only one setting fails before migration or server startup. PostgreSQL SQL must never be executed on MySQL, and MySQL SQL must never be executed on PostgreSQL.

## Organization lifecycle

Organization synchronization treats each payload as a complete snapshot for its `source`. Team and developer identities use `externalId`; hierarchy and membership use `parentExternalId` and `teamExternalId`. Run a request with `dryRun: true` before applying a full snapshot to inspect the create, update, move, unassign, and deactivate counts recorded in `sync_logs`.

Rows missing from a later snapshot are deactivated with `is_active=false`; they are not deleted. A missing developer retains the last `team_id` so existing `pipeline_runs.developer_id` and historical attribution remain intact, while active team/member queries exclude the row. An explicitly supplied `teamExternalId: null` unassigns an active developer. `sync_source` scopes reconciliation, so an identity managed by another source is rejected instead of being silently reassigned.

The organization changes and the full-snapshot diff commit in one transaction. `SyncLog` completion or error status is written outside that transaction, and a successful full apply clears the team subtree cache. Do not manually delete deactivated organization rows unless the corresponding pipeline-history impact has been reviewed.
