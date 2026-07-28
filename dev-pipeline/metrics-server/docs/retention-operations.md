# Retention operations

## Data states

Each repository uses its `retentionDays` value and the snapshot `updatedAtPipeline` timestamp.

- **Hot**: snapshot timestamp is on or after the repository cutoff. It remains queryable.
- **Warm**: snapshot is older than the cutoff but is `isLatest` or `isLatestHistorical`. It is always preserved for current trusted metrics and collection audit continuity.
- **Cold**: snapshot is older than the cutoff and neither latest flag is set. It is eligible for cleanup.

Deleting a repository through `DELETE /api/v1/repos/:id` is a soft delete. It disables collection and keeps all metrics, collection logs, and retention logs. `POST /api/v1/repos/:id/restore` restores the configuration in a disabled state; an administrator must enable it separately.

## Safety gates

Cleanup execution requires all of the following:

```env
RETENTION_ENABLED=true
RETENTION_DRY_RUN=false
RETENTION_CONFIRMATION=DELETE_EXPIRED_SNAPSHOTS
```

The scheduler uses `RETENTION_CRON_SCHEDULE` (default `30 2 * * *`). It records an eligibility check immediately at service startup and at every scheduled run. Missing enablement or a mismatched confirmation forces dry-run behavior and writes a `checked` operation log with the blocking reason.

Recommended rollout:

1. Keep `RETENTION_ENABLED=false` and inspect scheduled `checked` records.
2. Set `RETENTION_ENABLED=true` with the exact confirmation while retaining `RETENTION_DRY_RUN=true`.
3. Review eligible counts for every repository.
4. Set `RETENTION_DRY_RUN=false` only after the archive/backup policy is operational.

## Management API

- `GET /api/v1/repos/:id/retention` returns current classification and the latest operation logs.
- `GET /api/v1/repos/:id/retention/archive?take=100&cursor=...` exports a bounded page of eligible cold snapshot metadata and raw state for external backup. It never deletes data.
- `POST /api/v1/repos/:id/retention` with `{ "dryRun": true }` records a preview.
- `POST /api/v1/repos/:id/retention` with `{ "dryRun": false }` requests execution, still subject to environment gates.
- `POST /api/v1/repos/:id/restore` restores only a soft-deleted repository configuration.

Every check, preview, execution, and failure is stored in `retention_operation_logs` with cutoff, counts, trigger source, status, and error details. Retention execution deletes only cold `pipeline_runs`; dependent phase, review, decision, and gate rows follow their foreign-key cascade.

## Recovery boundary

Soft deletion is reversible through the restore endpoint. A completed retention cleanup is a physical deletion and cannot be reversed by the application. Recovery requires an external database backup or archive. Retention operation logs are audit evidence, not snapshot backups.
