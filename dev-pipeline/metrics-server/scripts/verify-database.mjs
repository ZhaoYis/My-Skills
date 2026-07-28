import { PrismaClient } from '@prisma/client';
import { resolvePrismaConfig } from './prisma-config.mjs';

const { provider } = resolvePrismaConfig();
const expectedTables = [
  'collection_logs',
  'developers',
  'phase_entry_decisions',
  'phase_entry_gates',
  'phase_history_entries',
  'pipeline_decisions',
  'pipeline_gates_bypassed',
  'pipeline_runs',
  'repos',
  'retention_operation_logs',
  'review_round_decisions',
  'review_rounds',
  'sync_logs',
  'teams',
];
const db = new PrismaClient();

try {
  const rows =
    provider === 'postgresql'
      ? await db.$queryRawUnsafe(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name",
        )
      : await db.$queryRawUnsafe(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name",
        );
  const actualTables = rows.map((row) => String(Object.values(row)[0]));
  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) {
    throw new Error(
      `Application table mismatch for ${provider}: expected ${expectedTables.join(', ')}, found ${actualTables.join(', ')}`,
    );
  }
  await db.$queryRaw`SELECT 1`;
  process.stdout.write(`Verified ${actualTables.length} application tables for ${provider}\n`);
} finally {
  await db.$disconnect();
}
