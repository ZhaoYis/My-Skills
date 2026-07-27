import type { PipelineRun, Prisma, PrismaClient } from '@prisma/client';
import { getTeamSubtreeIds } from './team-cache.js';

type RunFilter = Prisma.PipelineRunWhereInput;

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] ?? 0;
}

function round(value: number, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export class MetricsService {
  constructor(private readonly db: PrismaClient) {}

  private trustedFilter(developerIds: number[]): RunFilter {
    return { developerId: { in: developerIds }, isLatest: true, fingerprintVerified: true };
  }

  async teamDeveloperIds(teamId: number) {
    const teamIds = await getTeamSubtreeIds(this.db, teamId);
    const developers = await this.db.developer.findMany({
      where: { teamId: { in: teamIds } },
      select: { id: true },
    });
    return developers.map(({ id }) => id);
  }

  async overview(developerIds: number[], trendDays = 30) {
    const where = this.trustedFilter(developerIds);
    const runs = await this.db.pipelineRun.findMany({ where });
    const completed = runs.filter((run) => run.status === 'completed');
    const durations = completed.flatMap((run) =>
      run.changeDurationSeconds == null ? [] : [run.changeDurationSeconds],
    );
    const phases = await this.phaseBreakdown(developerIds);
    const bypassFrequency = await this.bypasses(developerIds);
    const pause = await this.pauses(developerIds);
    const rollbacks = await this.rollbackCount(developerIds);
    const effectiveMinutes = await this.effectiveCycleMinutes(developerIds);
    const recentTrend = await this.trend(developerIds, trendDays);
    const reviewPassedFirst = completed.filter(
      (run) => run.reviewStatus === 'passed' && run.reviewCurrentRound === 1,
    ).length;
    return {
      totalRuns: runs.length,
      completedRuns: completed.length,
      completionRate: round(completed.length / (runs.length || 1)),
      abandonmentRate: round(
        runs.filter((run) => run.archivePath && run.status !== 'completed').length / (runs.length || 1),
      ),
      monthlyCompleted: completed.filter(
        (run) => run.updatedAtPipeline >= new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      ).length,
      overdueRate: this.overdueRate(runs),
      avgCycleTimeMinutes: round(average(durations) / 60, 1),
      avgEffectiveCycleTimeMinutes: round(effectiveMinutes, 1),
      medianCycleTimeMinutes: round(percentile(durations, 0.5) / 60, 1),
      avgReviewRounds: round(average(completed.map((run) => run.reviewCurrentRound)), 2),
      reviewPassRate: round(reviewPassedFirst / (completed.length || 1)),
      testFirstPassRate: round(
        runs.filter((run) => run.testsAttempts > 0 && run.testsAttempts <= 1 && run.testsStatus === 'passed').length /
          (runs.filter((run) => run.testsAttempts > 0).length || 1),
      ),
      avgTestAttempts: round(average(runs.map((run) => run.testsAttempts)), 2),
      avgVerifyAttempts: round(average(runs.map((run) => run.verifyAttempts)), 2),
      avgRollbacksPerChange: round(rollbacks / (runs.length || 1), 2),
      pauseCount: pause.pauseCount,
      pauseRate: pause.pauseRate,
      bypassFrequency,
      bypassRate: round(
        Object.values(bypassFrequency).reduce((sum, count) => sum + count, 0) / (runs.length || 1),
      ),
      phaseBreakdown: phases,
      recentTrend,
    };
  }

  async cycleTime(developerIds: number[]) {
    const runs = await this.db.pipelineRun.findMany({
      where: { ...this.trustedFilter(developerIds), status: 'completed', changeDurationSeconds: { not: null } },
      select: { changeName: true, changeDurationSeconds: true, updatedAtPipeline: true },
      orderBy: { updatedAtPipeline: 'asc' },
    });
    const values = runs.map((run) => run.changeDurationSeconds ?? 0);
    return {
      averageMinutes: round(average(values) / 60, 1),
      medianMinutes: round(percentile(values, 0.5) / 60, 1),
      p95Minutes: round(percentile(values, 0.95) / 60, 1),
      records: runs.map((run) => ({ ...run, minutes: round((run.changeDurationSeconds ?? 0) / 60, 1) })),
    };
  }

  async phaseBreakdown(developerIds: number[]) {
    const entries = await this.db.phaseHistoryEntry.findMany({
      where: {
        status: 'completed',
        durationSeconds: { not: null },
        run: this.trustedFilter(developerIds),
      },
      select: { phase: true, durationSeconds: true },
    });
    return Array.from({ length: 7 }, (_, phase) => {
      const durations = entries.filter((entry) => entry.phase === phase).map((entry) => entry.durationSeconds ?? 0);
      return {
        phase,
        count: durations.length,
        avgSec: round(average(durations), 0),
        p50Sec: percentile(durations, 0.5),
        p95Sec: percentile(durations, 0.95),
      };
    });
  }

  async reviews(developerIds: number[]) {
    const runs = await this.db.pipelineRun.findMany({
      where: this.trustedFilter(developerIds),
      select: { reviewCurrentRound: true, reviewStatus: true, status: true },
    });
    const completed = runs.filter((run) => run.status === 'completed');
    return {
      averageRounds: round(average(runs.map((run) => run.reviewCurrentRound)), 2),
      firstPassRate: round(
        completed.filter((run) => run.reviewCurrentRound === 1 && run.reviewStatus === 'passed').length /
          (completed.length || 1),
      ),
      distribution: Array.from(new Set(runs.map((run) => run.reviewCurrentRound)))
        .sort((a, b) => a - b)
        .map((rounds) => ({ rounds, count: runs.filter((run) => run.reviewCurrentRound === rounds).length })),
    };
  }

  async completions(developerIds: number[]) {
    const runs = await this.db.pipelineRun.findMany({ where: this.trustedFilter(developerIds) });
    return {
      total: runs.length,
      completed: runs.filter((run) => run.status === 'completed').length,
      active: runs.filter((run) => run.status === 'active').length,
      paused: runs.filter((run) => run.status === 'paused').length,
      overdueRate: this.overdueRate(runs),
    };
  }

  async pauses(developerIds: number[]) {
    const runCount = await this.db.pipelineRun.count({ where: this.trustedFilter(developerIds) });
    const entries = await this.db.phaseHistoryEntry.findMany({
      where: { status: 'abandoned', run: this.trustedFilter(developerIds) },
      distinct: ['runId'],
      select: { runId: true },
    });
    return { pauseCount: entries.length, pauseRate: round(entries.length / (runCount || 1)) };
  }

  async bypasses(developerIds: number[]) {
    const gates = await this.db.pipelineGateBypassed.findMany({
      where: { run: this.trustedFilter(developerIds) },
      select: { gateName: true },
    });
    return Object.fromEntries(
      Array.from(new Set(gates.map(({ gateName }) => gateName))).map((name) => [
        name,
        gates.filter(({ gateName }) => gateName === name).length,
      ]),
    );
  }

  async trend(developerIds: number[], days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const runs = await this.db.pipelineRun.findMany({
      where: { ...this.trustedFilter(developerIds), updatedAtPipeline: { gte: since } },
      select: { updatedAtPipeline: true, changeDurationSeconds: true },
    });
    const dates = Array.from(new Set(runs.map((run) => run.updatedAtPipeline.toISOString().slice(0, 10)))).sort();
    return dates.map((date) => {
      const daily = runs.filter((run) => run.updatedAtPipeline.toISOString().startsWith(date));
      return {
        date,
        runs: daily.length,
        avgCycleMin: round(average(daily.map((run) => run.changeDurationSeconds ?? 0)) / 60, 1),
      };
    });
  }

  async members(teamId: number, skip: number, take: number) {
    const ids = await this.teamDeveloperIds(teamId);
    const [developers, totalCount] = await Promise.all([
      this.db.developer.findMany({ where: { id: { in: ids } }, skip, take, orderBy: { displayName: 'asc' } }),
      this.db.developer.count({ where: { id: { in: ids } } }),
    ]);
    const records = await Promise.all(
      developers.map(async (developer) => ({
        id: developer.id,
        displayName: developer.displayName,
        email: developer.email,
        ...(await this.overview([developer.id])),
      })),
    );
    return { records, totalCount };
  }

  private overdueRate(runs: PipelineRun[]) {
    const cutoff = Date.now() - 30 * 86_400_000;
    const mature = runs.filter((run) => run.createdAtPipeline.getTime() < cutoff);
    return round(mature.filter((run) => run.status !== 'completed').length / (mature.length || 1));
  }

  private async rollbackCount(developerIds: number[]) {
    const entries = await this.db.phaseHistoryEntry.findMany({
      where: { run: this.trustedFilter(developerIds) },
      select: { runId: true, phase: true },
      orderBy: [{ runId: 'asc' }, { startedAt: 'asc' }],
    });
    let count = 0;
    let previous: (typeof entries)[number] | undefined;
    for (const entry of entries) {
      if (previous?.runId === entry.runId && entry.phase < previous.phase) count += 1;
      previous = entry;
    }
    return count;
  }

  private async effectiveCycleMinutes(developerIds: number[]) {
    const entries = await this.db.phaseHistoryEntry.findMany({
      where: {
        status: 'completed',
        durationSeconds: { not: null },
        run: { ...this.trustedFilter(developerIds), status: 'completed' },
      },
      select: { runId: true, durationSeconds: true },
    });
    const totals = new Map<bigint, number>();
    for (const entry of entries) totals.set(entry.runId, (totals.get(entry.runId) ?? 0) + (entry.durationSeconds ?? 0));
    return average([...totals.values()]) / 60;
  }
}
