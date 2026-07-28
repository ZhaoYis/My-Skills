import type { PipelineRun, PrismaClient } from '@prisma/client';
import { readMetricsCache, writeMetricsCache } from './metrics-cache.js';
import {
  type DurationPercentiles,
  type MetricsInput,
  type MetricsQuery,
  normalizeMetricsQuery,
  type OverviewBatch,
  type OverviewGate,
  type OverviewPhase,
  type OverviewRun,
  PrismaMetricsQueryPort,
} from './metrics-query-port.js';
import { getTeamDeveloperIds } from './team-cache.js';

export type { MetricsQuery } from './metrics-query-port.js';

export interface MemberMetricsQuery extends MetricsQuery {
  q?: string;
  dataStatus?: 'all' | 'with-data' | 'without-data';
  sortBy?:
    | 'displayName'
    | 'completedRuns'
    | 'completionRate'
    | 'avgCycleTimeMinutes'
    | 'avgReviewRounds';
  sortOrder?: 'asc' | 'desc';
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return (
    (sorted[lower] ?? 0) + ((sorted[upper] ?? sorted[lower] ?? 0) - (sorted[lower] ?? 0)) * fraction
  );
}

function round(value: number, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export class MetricsService {
  private readonly queryPort: PrismaMetricsQueryPort;

  constructor(
    private readonly db: PrismaClient,
    queryPort?: PrismaMetricsQueryPort,
  ) {
    this.queryPort = queryPort ?? new PrismaMetricsQueryPort(db);
  }

  private trustedFilter(developerIds: number[], input?: MetricsInput) {
    return this.queryPort.trustedFilter(developerIds, input);
  }

  async teamDeveloperIds(teamId: number) {
    return getTeamDeveloperIds(this.db, teamId);
  }

  async overview(developerIds: number[], input: MetricsInput = 30) {
    const query = normalizeMetricsQuery(input);
    const cacheKey = JSON.stringify({
      scope: [...developerIds].sort((left, right) => left - right),
      days: query.days ?? null,
      repoId: query.repoId ?? null,
    });
    const cached = readMetricsCache<ReturnType<MetricsService['overviewFromBatch']>>(
      this.db,
      cacheKey,
    );
    if (cached) return cached;
    const [batch, durationPercentiles] = await Promise.all([
      this.queryPort.loadOverviewBatch(developerIds, query),
      this.queryPort.durationPercentiles(developerIds, query),
    ]);
    const result = this.overviewFromBatch(batch, durationPercentiles);
    writeMetricsCache(this.db, cacheKey, result);
    return result;
  }

  private overviewFromBatch(batch: OverviewBatch, durationPercentiles?: DurationPercentiles) {
    const { runs, phases: phaseEntries, gates } = batch;
    const completed = runs.filter((run) => run.status === 'completed');
    const durations = completed.flatMap((run) =>
      run.changeDurationSeconds == null ? [] : [run.changeDurationSeconds],
    );
    const phaseBreakdown = Array.from({ length: 7 }, (_, phase) => {
      const values = phaseEntries
        .filter((entry) => entry.phase === phase && entry.status === 'completed')
        .flatMap((entry) => (entry.durationSeconds == null ? [] : [entry.durationSeconds]));
      return {
        phase,
        count: values.length,
        avgSec: round(average(values), 0),
        p50Sec: percentile(values, 0.5),
        p95Sec: percentile(values, 0.95),
      };
    });
    const bypassDistribution = Object.fromEntries(
      Array.from(new Set(gates.map(({ gateName }) => gateName))).map((name) => [
        name,
        gates.filter(({ gateName }) => gateName === name).length,
      ]),
    );
    const pausedRunIds = new Set(
      phaseEntries.filter(({ status }) => status === 'abandoned').map(({ runId }) => runId),
    );
    let rollbacks = 0;
    let previous: OverviewPhase | undefined;
    for (const entry of phaseEntries) {
      if (previous?.runId === entry.runId && entry.phase < previous.phase) rollbacks += 1;
      previous = entry;
    }
    const completedRunIds = new Set(completed.map(({ id }) => id));
    const effectiveTotals = new Map<bigint, number>();
    for (const entry of phaseEntries) {
      if (
        entry.status === 'completed' &&
        entry.durationSeconds != null &&
        completedRunIds.has(entry.runId)
      ) {
        effectiveTotals.set(
          entry.runId,
          (effectiveTotals.get(entry.runId) ?? 0) + entry.durationSeconds,
        );
      }
    }
    const trendDates = Array.from(
      new Set(
        completed.flatMap((run) =>
          run.completedAtPipeline ? [run.completedAtPipeline.toISOString().slice(0, 10)] : [],
        ),
      ),
    ).sort();
    const recentTrend = trendDates.map((date) => {
      const daily = completed.filter((run) =>
        run.completedAtPipeline?.toISOString().startsWith(date),
      );
      return {
        date,
        runs: daily.length,
        avgCycleMin: round(
          average(
            daily.flatMap((run) =>
              run.changeDurationSeconds == null ? [] : [run.changeDurationSeconds],
            ),
          ) / 60,
          1,
        ),
      };
    });
    const reviewPassedFirst = completed.filter(
      (run) => run.reviewStatus === 'passed' && run.reviewCurrentRound === 1,
    ).length;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return {
      totalRuns: runs.length,
      completedRuns: completed.length,
      completionRate: round(completed.length / (runs.length || 1)),
      abandonmentRate: round(
        runs.filter((run) => run.archivePath && run.status !== 'completed').length /
          (runs.length || 1),
      ),
      monthlyCompleted: completed.filter(
        (run) => run.completedAtPipeline && run.completedAtPipeline >= monthStart,
      ).length,
      overdueRate: this.overdueRate(runs),
      avgCycleTimeMinutes: round(average(durations) / 60, 1),
      avgEffectiveCycleTimeMinutes: round(average([...effectiveTotals.values()]) / 60, 1),
      medianCycleTimeMinutes: round(
        (durationPercentiles?.medianSeconds ?? percentile(durations, 0.5)) / 60,
        1,
      ),
      avgReviewRounds: round(average(completed.map((run) => run.reviewCurrentRound)), 2),
      reviewPassRate: round(reviewPassedFirst / (completed.length || 1)),
      testFirstPassRate: round(
        completed.filter((run) => run.testsAttempts === 1 && run.testsStatus === 'passed').length /
          (completed.filter((run) => run.testsAttempts > 0).length || 1),
      ),
      avgTestAttempts: round(average(completed.map((run) => run.testsAttempts)), 2),
      avgVerifyAttempts: round(average(completed.map((run) => run.verifyAttempts)), 2),
      avgRollbacksPerChange: round(rollbacks / (runs.length || 1), 2),
      pauseCount: pausedRunIds.size,
      pauseRate: round(pausedRunIds.size / (runs.length || 1)),
      bypassFrequency: bypassDistribution,
      bypassRate: round(new Set(gates.map(({ runId }) => runId)).size / (runs.length || 1)),
      phaseBreakdown,
      recentTrend,
    };
  }

  async cycleTime(developerIds: number[], input?: MetricsInput) {
    const [runs, durationPercentiles] = await Promise.all([
      this.db.pipelineRun.findMany({
        where: {
          ...this.trustedFilter(developerIds, input),
          status: 'completed',
          completedAtPipeline: { not: null },
          changeDurationSeconds: { not: null },
        },
        select: {
          changeName: true,
          changeDurationSeconds: true,
          completedAtPipeline: true,
          updatedAtPipeline: true,
        },
        orderBy: { completedAtPipeline: 'asc' },
      }),
      this.queryPort.durationPercentiles(developerIds, input),
    ]);
    const values = runs.flatMap((run) =>
      run.changeDurationSeconds == null ? [] : [run.changeDurationSeconds],
    );
    return {
      averageMinutes: round(average(values) / 60, 1),
      medianMinutes: round(durationPercentiles.medianSeconds / 60, 1),
      p95Minutes: round(durationPercentiles.p95Seconds / 60, 1),
      records: runs.map((run) => ({
        ...run,
        minutes: round((run.changeDurationSeconds ?? 0) / 60, 1),
      })),
    };
  }

  async phaseBreakdown(developerIds: number[], input?: MetricsInput) {
    const entries = await this.db.phaseHistoryEntry.findMany({
      where: {
        status: 'completed',
        durationSeconds: { not: null },
        run: this.trustedFilter(developerIds, input),
      },
      select: { phase: true, durationSeconds: true },
    });
    return Array.from({ length: 7 }, (_, phase) => {
      const durations = entries
        .filter((entry) => entry.phase === phase)
        .map((entry) => entry.durationSeconds ?? 0);
      return {
        phase,
        count: durations.length,
        avgSec: round(average(durations), 0),
        p50Sec: percentile(durations, 0.5),
        p95Sec: percentile(durations, 0.95),
      };
    });
  }

  async reviews(developerIds: number[], input?: MetricsInput) {
    const runs = await this.db.pipelineRun.findMany({
      where: { ...this.trustedFilter(developerIds, input), status: 'completed' },
      select: { reviewCurrentRound: true, reviewStatus: true },
    });
    return {
      averageRounds: round(average(runs.map((run) => run.reviewCurrentRound)), 2),
      firstPassRate: round(
        runs.filter((run) => run.reviewCurrentRound === 1 && run.reviewStatus === 'passed').length /
          (runs.length || 1),
      ),
      distribution: Array.from(new Set(runs.map((run) => run.reviewCurrentRound)))
        .sort((a, b) => a - b)
        .map((rounds) => ({
          rounds,
          count: runs.filter((run) => run.reviewCurrentRound === rounds).length,
        })),
    };
  }

  async completions(developerIds: number[], input?: MetricsInput) {
    const runs = await this.db.pipelineRun.findMany({
      where: this.trustedFilter(developerIds, input),
      select: { status: true, createdAtPipeline: true },
    });
    return {
      total: runs.length,
      completed: runs.filter((run) => run.status === 'completed').length,
      active: runs.filter((run) => run.status === 'active').length,
      paused: runs.filter((run) => run.status === 'paused').length,
      overdueRate: this.overdueRate(runs),
    };
  }

  async pauses(developerIds: number[], input?: MetricsInput) {
    const runFilter = this.trustedFilter(developerIds, input);
    const [runCount, entries] = await Promise.all([
      this.db.pipelineRun.count({ where: runFilter }),
      this.db.phaseHistoryEntry.findMany({
        where: { status: 'abandoned', run: runFilter },
        distinct: ['runId'],
        select: { runId: true },
      }),
    ]);
    return { pauseCount: entries.length, pauseRate: round(entries.length / (runCount || 1)) };
  }

  async bypasses(developerIds: number[], input?: MetricsInput) {
    return (await this.bypassStats(developerIds, input)).distribution;
  }

  async trend(developerIds: number[], input: MetricsInput = 30) {
    const runs = await this.db.pipelineRun.findMany({
      where: {
        ...this.trustedFilter(developerIds, input),
        status: 'completed',
        completedAtPipeline: { not: null },
        changeDurationSeconds: { not: null },
      },
      select: { completedAtPipeline: true, changeDurationSeconds: true },
    });
    const dates = Array.from(
      new Set(
        runs.flatMap((run) =>
          run.completedAtPipeline ? [run.completedAtPipeline.toISOString().slice(0, 10)] : [],
        ),
      ),
    ).sort();
    return dates.map((date) => {
      const daily = runs.filter((run) => run.completedAtPipeline?.toISOString().startsWith(date));
      return {
        date,
        runs: daily.length,
        avgCycleMin: round(
          average(
            daily.flatMap((run) =>
              run.changeDurationSeconds == null ? [] : [run.changeDurationSeconds],
            ),
          ) / 60,
          1,
        ),
      };
    });
  }

  async members(teamId: number, pageNum: number, pageSize: number, input: MemberMetricsQuery = {}) {
    const ids = await this.teamDeveloperIds(teamId);
    const developers = await this.db.developer.findMany({
      where: { id: { in: ids }, isActive: true },
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }, { id: 'asc' }],
    });
    const normalizedQuery = input.q?.trim().toLocaleLowerCase() ?? '';
    const matchingDevelopers = developers.filter((developer) => {
      if (!normalizedQuery) return true;
      return [developer.displayName, developer.email].some((value) =>
        value?.toLocaleLowerCase().includes(normalizedQuery),
      );
    });
    const metricsQuery = { days: input.days, repoId: input.repoId };
    const batch = await this.queryPort.loadOverviewBatch(
      matchingDevelopers.map(({ id }) => id),
      metricsQuery,
    );
    const runsByDeveloper = new Map<number, OverviewRun[]>();
    const phasesByDeveloper = new Map<number, OverviewPhase[]>();
    const gatesByDeveloper = new Map<number, OverviewGate[]>();
    for (const run of batch.runs) {
      if (run.developerId == null) continue;
      const records = runsByDeveloper.get(run.developerId) ?? [];
      records.push(run);
      runsByDeveloper.set(run.developerId, records);
    }
    for (const phase of batch.phases) {
      if (phase.run.developerId == null) continue;
      const records = phasesByDeveloper.get(phase.run.developerId) ?? [];
      records.push(phase);
      phasesByDeveloper.set(phase.run.developerId, records);
    }
    for (const gate of batch.gates) {
      if (gate.run.developerId == null) continue;
      const records = gatesByDeveloper.get(gate.run.developerId) ?? [];
      records.push(gate);
      gatesByDeveloper.set(gate.run.developerId, records);
    }
    let records = matchingDevelopers.map((developer) => ({
      id: developer.id,
      displayName: developer.displayName,
      email: developer.email,
      team: developer.team,
      ...this.overviewFromBatch({
        runs: runsByDeveloper.get(developer.id) ?? [],
        phases: phasesByDeveloper.get(developer.id) ?? [],
        gates: gatesByDeveloper.get(developer.id) ?? [],
      }),
    }));
    if (input.dataStatus === 'with-data')
      records = records.filter(({ totalRuns }) => totalRuns > 0);
    if (input.dataStatus === 'without-data') {
      records = records.filter(({ totalRuns }) => totalRuns === 0);
    }
    const sortBy = input.sortBy ?? 'displayName';
    const direction = input.sortOrder === 'desc' ? -1 : 1;
    records.sort((left, right) => {
      const leftValue = sortBy === 'displayName' ? (left.displayName ?? left.email) : left[sortBy];
      const rightValue =
        sortBy === 'displayName' ? (right.displayName ?? right.email) : right[sortBy];
      const compared =
        typeof leftValue === 'string' && typeof rightValue === 'string'
          ? leftValue.localeCompare(rightValue)
          : Number(leftValue) - Number(rightValue);
      if (compared !== 0) return compared * direction;
      return left.id - right.id;
    });
    const totalCount = records.length;
    const skip = (pageNum - 1) * pageSize;
    return { records: records.slice(skip, skip + pageSize), totalCount };
  }

  async member(teamId: number, developerId: number, input?: MetricsInput) {
    const ids = await this.teamDeveloperIds(teamId);
    if (!ids.includes(developerId)) return null;
    const developer = await this.db.developer.findFirst({
      where: { id: developerId, isActive: true },
      include: { team: { select: { id: true, name: true } } },
    });
    if (!developer) return null;
    return {
      id: developer.id,
      displayName: developer.displayName,
      email: developer.email,
      team: developer.team,
      overview: await this.overview([developer.id], input),
    };
  }

  private overdueRate(runs: Array<Pick<PipelineRun, 'status' | 'createdAtPipeline'>>) {
    const cutoff = Date.now() - 30 * 86_400_000;
    const mature = runs.filter((run) => run.createdAtPipeline.getTime() < cutoff);
    return round(mature.filter((run) => run.status !== 'completed').length / (mature.length || 1));
  }

  private async bypassStats(developerIds: number[], input?: MetricsInput) {
    const gates = await this.db.pipelineGateBypassed.findMany({
      where: { run: this.trustedFilter(developerIds, input) },
      select: { runId: true, gateName: true },
    });
    const distribution = Object.fromEntries(
      Array.from(new Set(gates.map(({ gateName }) => gateName))).map((name) => [
        name,
        gates.filter(({ gateName }) => gateName === name).length,
      ]),
    );
    return { distribution, changeCount: new Set(gates.map(({ runId }) => runId)).size };
  }
}
