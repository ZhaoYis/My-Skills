import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { MetricsService } from '../src/services/metrics-service.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
let repoId: number | undefined;
let developerId: number | undefined;

describe.runIf(enabled)('trusted metrics aggregation', () => {
  it('filters unverified snapshots and calculates cycle, review, test, and phase metrics', async () => {
    const now = new Date();
    await db!.repo.deleteMany({ where: { name: 'metrics-test' } });
    await db!.developer.deleteMany({ where: { email: 'metrics-integration@example.invalid' } });
    const repo = await db!.repo.create({
      data: {
        name: 'metrics-test',
        gitUrl: 'https://example.invalid/metrics.git',
        collectSince: now,
      },
    });
    const developer = await db!.developer.create({
      data: {
        email: 'metrics-integration@example.invalid',
        displayName: 'Metrics Integration',
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
    repoId = repo.id;
    developerId = developer.id;
    const common = {
      repoId: repo.id,
      developerId: developer.id,
      changeName: 'trusted-change',
      stateVersion: 3,
      sourceBranch: 'feature/trusted',
      currentPhase: 6,
      currentStep: 24,
      status: 'completed',
      executionMode: 'pipeline',
      isLatest: true,
      isLatestHistorical: true,
      snapshotSource: 'collector',
      fingerprintId: `fp1.${'A'.repeat(342)}`,
      fingerprintNonce: '1234abcd',
      fingerprintKeyVersion: 'fp1',
      createdByEmail: developer.email,
      createdBy: developer.displayName!,
      createdAtSource: new Date(now.getTime() - 600_000),
      reviewStatus: 'passed',
      reviewCurrentRound: 1,
      testsAttempts: 1,
      testsStatus: 'passed',
      verifyAttempts: 1,
      verifyStatus: 'passed',
      createdAtPipeline: new Date(now.getTime() - 600_000),
      updatedAtPipeline: now,
      completedAtPipeline: now,
      changeDurationSeconds: 600,
      commitSha: 'a'.repeat(40),
      commitTimestamp: now,
    };
    await db!.pipelineRun.create({
      data: {
        ...common,
        fingerprintVerified: true,
        contentHash: 'a'.repeat(32),
        gatesBypassed: {
          create: [{ gateName: 'review' }, { gateName: 'tests' }],
        },
        phaseHistory: {
          create: {
            phase: 2,
            step: 8,
            executedBy: 'pipeline',
            status: 'completed',
            startedAt: new Date(now.getTime() - 300_000),
            completedAt: now,
            durationSeconds: 300,
          },
        },
      },
    });
    await db!.pipelineRun.create({
      data: {
        ...common,
        changeName: 'untrusted-change',
        fingerprintVerified: false,
        contentHash: 'b'.repeat(32),
        commitSha: 'b'.repeat(40),
      },
    });
    await db!.pipelineRun.create({
      data: {
        ...common,
        changeName: 'active-change',
        status: 'active',
        reviewCurrentRound: 9,
        completedAtPipeline: null,
        changeDurationSeconds: null,
        fingerprintVerified: true,
        contentHash: 'c'.repeat(32),
        commitSha: 'c'.repeat(40),
      },
    });
    const oldCompletion = new Date(now.getTime() - 60 * 86_400_000);
    await db!.pipelineRun.create({
      data: {
        ...common,
        changeName: 'old-completed-change',
        createdAtSource: new Date(oldCompletion.getTime() - 1_200_000),
        createdAtPipeline: new Date(oldCompletion.getTime() - 1_200_000),
        completedAtPipeline: oldCompletion,
        updatedAtPipeline: now,
        changeDurationSeconds: 1_200,
        fingerprintVerified: true,
        contentHash: 'd'.repeat(32),
        commitSha: 'd'.repeat(40),
        gatesBypassed: { create: [{ gateName: 'archive' }] },
      },
    });

    const service = new MetricsService(db!);
    const overview = await service.overview([developer.id], { days: 30, repoId: repo.id });
    expect(overview).toMatchObject({
      totalRuns: 2,
      completedRuns: 1,
      completionRate: 0.5,
      avgCycleTimeMinutes: 10,
      reviewPassRate: 1,
      testFirstPassRate: 1,
      monthlyCompleted: 1,
      bypassRate: 0.5,
      bypassFrequency: { review: 1, tests: 1 },
    });
    expect(overview.bypassRate).toBeGreaterThanOrEqual(0);
    expect(overview.bypassRate).toBeLessThanOrEqual(1);
    expect(overview.phaseBreakdown.find((entry) => entry.phase === 2)).toMatchObject({
      count: 1,
      avgSec: 300,
    });
    expect(overview.recentTrend).toHaveLength(1);

    const ninetyDays = await service.overview([developer.id], { days: 90, repoId: repo.id });
    expect(ninetyDays).toMatchObject({
      totalRuns: 3,
      completedRuns: 2,
      monthlyCompleted: 1,
      avgCycleTimeMinutes: 15,
      bypassFrequency: { review: 1, tests: 1, archive: 1 },
    });
    expect(await service.reviews([developer.id], { days: 30, repoId: repo.id })).toMatchObject({
      averageRounds: 1,
      firstPassRate: 1,
    });
    expect(await service.cycleTime([developer.id], { days: 30, repoId: repo.id })).toMatchObject({
      averageMinutes: 10,
    });
    expect(await service.completions([developer.id], { days: 30, repoId: repo.id })).toMatchObject({
      total: 2,
      completed: 1,
      active: 1,
    });
    expect(await service.overview([2_000_000_000], { days: 30 })).toMatchObject({
      totalRuns: 0,
      completedRuns: 0,
      completionRate: 0,
      bypassRate: 0,
    });
  }, 60_000);
});

afterAll(async () => {
  if (repoId) await db!.repo.delete({ where: { id: repoId } });
  if (developerId) await db!.developer.delete({ where: { id: developerId } });
  await db?.$disconnect();
});
