# Data access boundaries

The server uses injectable service/query ports, not a model-per-table Repository layer.

- HTTP routes parse the protocol, call a service/query port, and map the result to an HTTP response. They do not call Prisma delegates directly.
- Stable query groups own filtering, field selection, pagination pairs, and provider-specific SQL. Examples are `AdministrationService`, `PrismaMetricsQueryPort`, and `RetentionService`.
- Business services own state transitions and transactions. `OrganizationAdminService`, `CollectionService`, and organization sync keep multi-table writes inside a single service boundary.
- Services accept a Prisma-compatible client in their constructor or function argument. Unit tests replace it with an in-memory mock and do not connect to a database.
- `src/models` is intentionally empty. The previous eight classes wrapped one Prisma call each, had no consumers, and were removed to avoid maintaining two competing access styles.

`pageParams` remains the HTTP pagination normalizer. Services accept normalized `skip`/`take` and return `{ records, totalCount }`, so the records and count queries share one filter implementation.

The architecture test `test/data-access-boundaries.test.ts` rejects direct `prisma.<delegate>` calls in route modules and any reintroduced TypeScript Repository skeleton under `src/models`.
