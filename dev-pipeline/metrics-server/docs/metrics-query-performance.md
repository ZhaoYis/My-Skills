# Metrics query performance

## Query boundaries

- Trusted metrics always require `is_latest = true`, `fingerprint_verified = true`, and `snapshot_source = collector`.
- API queries are bounded to 7, 30, or 90 days and may be narrowed by `repoId`.
- Overview reads select only calculation fields. Team member overview data is loaded in three batch queries, independent of member count.
- PostgreSQL cycle percentiles use `PERCENTILE_CONT`. MySQL sorts at most `METRICS_PERCENTILE_MAX_ROWS` values and rejects larger inputs instead of returning a biased percentile.

## Index and cache policy

- `pipeline_runs_trusted_latest_query_idx` covers developer, trusted-latest flags, completion time, and repository filtering.
- Team subtree and active member ID caches use `METRICS_TEAM_CACHE_TTL_MS` (default 60 seconds). Team, developer, and organization-sync mutations call `clearTeamCache()` after a successful write.
- Overview results use `METRICS_RESULT_CACHE_TTL_MS` (default 15 seconds), are isolated per Prisma client, and are cleared after a trusted snapshot is inserted. Set the TTL to `0` to disable result caching.

## Verification

Run the query-plan integration test against PostgreSQL:

```sh
TEST_DATABASE_URL=... npx vitest run --no-file-parallelism test/metrics-performance.integration.test.ts
```

Run the configurable, read-only million-row percentile benchmark:

```sh
TEST_DATABASE_URL=... DB_PROVIDER=postgresql npm run benchmark:metrics
```

`METRICS_BENCHMARK_ROWS` defaults to 1,000,000. `METRICS_BENCHMARK_MAX_MS` defaults to 10,000; the command exits non-zero when the threshold is exceeded. PostgreSQL uses `generate_series` and MySQL uses an in-process controlled dataset, so the benchmark does not persist rows.
