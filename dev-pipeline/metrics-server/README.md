# Metrics Server

Express + Prisma service for trusted pipeline-state collection and metrics aggregation.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `FINGERPRINT_PRIVATE_KEYS`.
2. Select `DB_PROVIDER=postgresql` or `DB_PROVIDER=mysql`.
3. Run `npm install`, `npm run prisma:generate`, and `npm run prisma:migrate`.
4. Start the API with `npm run dev`.

The Prisma provider is materialized from `prisma/schema.template.prisma` because Prisma requires a literal provider. Provider-specific schemas and migrations live under `prisma/providers/<provider>/`; every Prisma command validates that `DB_PROVIDER`, `DATABASE_URL`, and the migration provider marker agree. See [database operations](docs/database-operations.md) for initialization, upgrades, rollback, and provider switching.

Production startup rejects missing, placeholder, incomplete, or unsafe authentication, fingerprint,
CORS, and adapter configuration. See [production operations](docs/production-operations.md) for key
generation/rotation, incident recovery, probes, metrics scraping, and alert guidance.

Health and monitoring endpoints:

- `GET /api/v1/health/live`: process liveness only
- `GET /api/v1/health/ready`: database and critical-key readiness
- `GET /api/v1/health`: compatibility liveness endpoint
- `GET /observability/metrics`: Prometheus text; restrict at the deployment network boundary

## Commands

- `npm run collector -- --all`
- `npm run collector -- --repo 3`
- `npm run collector -- --all --dry-run`
- `npm run collector -- --daemon --schedule "0 */4 * * *"`

All metrics queries include `isLatest=true` and `fingerprintVerified=true`.

## Support matrix

| Area | Supported | Deployment/validation boundary |
| --- | --- | --- |
| Database | PostgreSQL 16+, MySQL 8.4+ | Provider-specific schema and migration sources; PostgreSQL is locally acceptance-tested and both providers run the same CI acceptance command |
| User authentication | Website OIDC exchange to short-lived server JWT | JWT signature, issuer, audience, expiry, active state, role, team, and token version are checked |
| Service authentication | Hashed `keyId.secret` key ring | Purposes are limited to `session-exchange` and/or `management`; raw `API_KEY` is non-production only |
| Local identity | Explicit developer impersonation | Development only; production configuration is rejected |
| Collection | Trusted fp1, explicit legacy history import, durable jobs | Repository Git credentials must be provided by the deployment environment |
| Organization | JSON upload plus Feishu, LDAP, and WeCom adapters | Fixture tests cover all adapters; live Feishu verification runs only when server-side credentials are present |
| Operations | Liveness, readiness, Prometheus text, structured logs, retention | Metrics endpoint must be restricted by the deployment network boundary |

## Deployment and tests

Use Node.js 20+. Run provider preparation, validation, client generation, and migration before starting
the server. Readiness must pass before receiving traffic. Database backup/upgrade/switch procedures are
in [database operations](docs/database-operations.md); secrets, probes, alerts, and recovery are in
[production operations](docs/production-operations.md).

```bash
npm run contract:check
npm run lint
npm run typecheck
npm test
npm run test:db
```

Known limits:

- MySQL live acceptance is CI-owned unless a local MySQL test URL is explicitly supplied.
- External adapter live verification is credential-gated; a skipped credential check is not reported as a pass.
- The MySQL percentile path uses the configured bounded row limit; benchmark results are not a production SLA.
- The service is not a multi-tenant isolation boundary, and `/observability/metrics` has no application-level authentication.

## Organization synchronization

Canonical JSON can be previewed with `POST /api/v1/sync/org/preview`; a successful dry-run is confirmed through `POST /api/v1/sync/logs/:id/apply`. History, detail, and failed-run retry are available under `/api/v1/sync/logs`.

Feishu, LDAP, and WeCom have separate canonical conversion modules. Feishu also supports paginated server-side pull when `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are configured. Adapter status responses expose only `configured` and capabilities; credentials are never accepted from or returned to the browser. Run the optional credential-gated verification with:

```bash
npm run test:adapter:e2e
```

Without Feishu credentials the command reports `SKIPPED`; fixture contract tests remain part of `npm test`.
