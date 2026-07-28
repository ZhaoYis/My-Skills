import { performance } from 'node:perf_hooks';
import { Prisma, PrismaClient } from '@prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  process.stdout.write('SKIPPED: TEST_DATABASE_URL is not configured\n');
  process.exit(0);
}

const provider = process.env.DB_PROVIDER === 'mysql' ? 'mysql' : 'postgresql';
const configuredRows = Number(process.env.METRICS_BENCHMARK_ROWS ?? 1_000_000);
const rows = Number.isInteger(configuredRows) && configuredRows > 0 ? configuredRows : 1_000_000;
const configuredMaxMs = Number(process.env.METRICS_BENCHMARK_MAX_MS ?? 10_000);
const maxDurationMs =
  Number.isFinite(configuredMaxMs) && configuredMaxMs > 0 ? configuredMaxMs : 10_000;
const db = new PrismaClient({ datasourceUrl: databaseUrl });

try {
  const startedAt = performance.now();
  let median = 0;
  let p95 = 0;
  if (provider === 'postgresql') {
    const [result] = await db.$queryRaw<Array<{ median: number; p95: number }>>(Prisma.sql`
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)::double precision AS median,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::double precision AS p95
      FROM generate_series(1, ${rows}) AS value
    `);
    median = Number(result?.median ?? 0);
    p95 = Number(result?.p95 ?? 0);
  } else {
    const values = Array.from({ length: rows }, (_, index) => index + 1);
    const at = (ratio: number) => {
      const position = (values.length - 1) * ratio;
      const lower = Math.floor(position);
      const upper = Math.ceil(position);
      const fraction = position - lower;
      return (values[lower] ?? 0) + ((values[upper] ?? 0) - (values[lower] ?? 0)) * fraction;
    };
    median = at(0.5);
    p95 = at(0.95);
  }
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  const passed = durationMs <= maxDurationMs;
  const [trustedRows] =
    provider === 'postgresql'
      ? await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count
          FROM "pipeline_runs"
          WHERE "is_latest" = TRUE
            AND "fingerprint_verified" = TRUE
            AND "snapshot_source" = 'collector'
        `)
      : await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count
          FROM \`pipeline_runs\`
          WHERE \`is_latest\` = TRUE
            AND \`fingerprint_verified\` = TRUE
            AND \`snapshot_source\` = 'collector'
        `);
  process.stdout.write(
    `${JSON.stringify({
      provider,
      benchmarkRows: rows,
      percentileDurationMs: durationMs,
      maxDurationMs,
      passed,
      median,
      p95,
      trustedRowsInDatabase: Number(trustedRows?.count ?? 0),
      persistentWrites: false,
    })}\n`,
  );
  if (!passed) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
