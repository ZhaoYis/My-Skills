import { Prisma, type PrismaClient } from '@prisma/client';

export interface MetricsQuery {
  days?: number;
  repoId?: number;
}

export type MetricsInput = number | MetricsQuery | undefined;

export function normalizeMetricsQuery(input: MetricsInput): MetricsQuery {
  return typeof input === 'number' ? { days: input } : (input ?? {});
}

export function trustedRunFilter(
  developerIds: number[],
  input?: MetricsInput,
): Prisma.PipelineRunWhereInput {
  const query = normalizeMetricsQuery(input);
  const where: Prisma.PipelineRunWhereInput = {
    developerId: { in: developerIds },
    isLatest: true,
    fingerprintVerified: true,
    snapshotSource: 'collector',
  };
  if (query.repoId) where.repoId = query.repoId;
  if (query.days) {
    const since = new Date(Date.now() - query.days * 86_400_000);
    where.OR = [
      { status: 'completed', completedAtPipeline: { gte: since } },
      { status: { not: 'completed' }, updatedAtPipeline: { gte: since } },
    ];
  }
  return where;
}

export const overviewRunSelect = {
  id: true,
  developerId: true,
  status: true,
  archivePath: true,
  createdAtPipeline: true,
  completedAtPipeline: true,
  changeDurationSeconds: true,
  reviewStatus: true,
  reviewCurrentRound: true,
  testsAttempts: true,
  testsStatus: true,
  verifyAttempts: true,
} satisfies Prisma.PipelineRunSelect;

const overviewPhaseSelect = {
  runId: true,
  phase: true,
  status: true,
  startedAt: true,
  durationSeconds: true,
  run: { select: { developerId: true } },
} satisfies Prisma.PhaseHistoryEntrySelect;

const overviewGateSelect = {
  runId: true,
  gateName: true,
  run: { select: { developerId: true } },
} satisfies Prisma.PipelineGateBypassedSelect;

export type OverviewRun = Prisma.PipelineRunGetPayload<{ select: typeof overviewRunSelect }>;
export type OverviewPhase = Prisma.PhaseHistoryEntryGetPayload<{
  select: typeof overviewPhaseSelect;
}>;
export type OverviewGate = Prisma.PipelineGateBypassedGetPayload<{
  select: typeof overviewGateSelect;
}>;

export interface OverviewBatch {
  runs: OverviewRun[];
  phases: OverviewPhase[];
  gates: OverviewGate[];
}

export interface DurationPercentiles {
  medianSeconds: number;
  p95Seconds: number;
}

export class PercentileInputLimitError extends Error {}

function continuousPercentile(sorted: number[], ratio: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return (
    (sorted[lower] ?? 0) + ((sorted[upper] ?? sorted[lower] ?? 0) - (sorted[lower] ?? 0)) * fraction
  );
}

export class PrismaMetricsQueryPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly provider: 'postgresql' | 'mysql' = process.env.DB_PROVIDER === 'mysql'
      ? 'mysql'
      : 'postgresql',
    private readonly percentileMaxRows = Number(process.env.METRICS_PERCENTILE_MAX_ROWS) || 100_000,
  ) {}

  trustedFilter(developerIds: number[], input?: MetricsInput) {
    return trustedRunFilter(developerIds, input);
  }

  async loadOverviewBatch(developerIds: number[], input?: MetricsInput): Promise<OverviewBatch> {
    if (!developerIds.length) return { runs: [], phases: [], gates: [] };
    const where = this.trustedFilter(developerIds, input);
    const [runs, phases, gates] = await Promise.all([
      this.db.pipelineRun.findMany({ where, select: overviewRunSelect }),
      this.db.phaseHistoryEntry.findMany({
        where: { run: where },
        select: overviewPhaseSelect,
        orderBy: [{ runId: 'asc' }, { startedAt: 'asc' }],
      }),
      this.db.pipelineGateBypassed.findMany({ where: { run: where }, select: overviewGateSelect }),
    ]);
    return { runs, phases, gates };
  }

  async durationPercentiles(
    developerIds: number[],
    input?: MetricsInput,
  ): Promise<DurationPercentiles> {
    if (!developerIds.length) return { medianSeconds: 0, p95Seconds: 0 };
    if (this.provider === 'postgresql') {
      const query = normalizeMetricsQuery(input);
      const conditions = [
        Prisma.sql`"developer_id" IN (${Prisma.join(developerIds)})`,
        Prisma.sql`"is_latest" = TRUE`,
        Prisma.sql`"fingerprint_verified" = TRUE`,
        Prisma.sql`"snapshot_source" = 'collector'`,
        Prisma.sql`"status" = 'completed'`,
        Prisma.sql`"change_duration_seconds" IS NOT NULL`,
      ];
      if (query.repoId) conditions.push(Prisma.sql`"repo_id" = ${query.repoId}`);
      if (query.days) {
        const since = new Date(Date.now() - query.days * 86_400_000);
        conditions.push(Prisma.sql`"completed_at_pipeline" >= ${since}`);
      }
      const [row] = await this.db.$queryRaw<
        Array<{ medianSeconds: number | null; p95Seconds: number | null }>
      >(Prisma.sql`
        SELECT
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "change_duration_seconds")::double precision AS "medianSeconds",
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "change_duration_seconds")::double precision AS "p95Seconds"
        FROM "pipeline_runs"
        WHERE ${Prisma.join(conditions, ' AND ')}
      `);
      return {
        medianSeconds: Number(row?.medianSeconds ?? 0),
        p95Seconds: Number(row?.p95Seconds ?? 0),
      };
    }

    const rows = await this.db.pipelineRun.findMany({
      where: {
        ...this.trustedFilter(developerIds, input),
        status: 'completed',
        changeDurationSeconds: { not: null },
      },
      select: { changeDurationSeconds: true },
      orderBy: { changeDurationSeconds: 'asc' },
      take: this.percentileMaxRows + 1,
    });
    if (rows.length > this.percentileMaxRows) {
      throw new PercentileInputLimitError(
        `MySQL percentile input exceeds METRICS_PERCENTILE_MAX_ROWS=${this.percentileMaxRows}`,
      );
    }
    const values = rows.flatMap(({ changeDurationSeconds }) =>
      changeDurationSeconds == null ? [] : [changeDurationSeconds],
    );
    return {
      medianSeconds: continuousPercentile(values, 0.5),
      p95Seconds: continuousPercentile(values, 0.95),
    };
  }
}
