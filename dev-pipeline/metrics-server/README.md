# Metrics Server

Express + Prisma service for trusted pipeline-state collection and metrics aggregation.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `FINGERPRINT_PRIVATE_KEYS`.
2. Select `DB_PROVIDER=postgresql` or `DB_PROVIDER=mysql`.
3. Run `npm install`, `npm run prisma:generate`, and `npm run prisma:migrate`.
4. Start the API with `npm run dev`.

The Prisma provider is materialized from `prisma/schema.template.prisma` because Prisma requires a literal provider. `npm run prisma:prepare` makes `prisma/schema.prisma` match `DB_PROVIDER` before generate, push, or migrate commands.

## Commands

- `npm run collector -- --all`
- `npm run collector -- --repo 3`
- `npm run collector -- --all --dry-run`
- `npm run collector -- --daemon --schedule "0 */4 * * *"`

All metrics queries include `isLatest=true` and `fingerprintVerified=true`.
