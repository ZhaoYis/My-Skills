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
    const repo = await db!.repo.create({ data: { name: 'metrics-test', gitUrl: 'https://example.invalid/metrics.git', collectSince: now } });
    const developer = await db!.developer.create({ data: { email: 'metrics-integration@example.invalid', displayName: 'Metrics Integration', firstSeenAt: now, lastSeenAt: now } });
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
      changeDurationSeconds: 600,
      commitSha: 'a'.repeat(40),
      commitTimestamp: now,
    };
    await db!.pipelineRun.create({
      data: {
        ...common,
        fingerprintVerified: true,
        contentHash: 'a'.repeat(32),
        phaseHistory: { create: { phase: 2, step: 8, executedBy: 'pipeline', status: 'completed', startedAt: new Date(now.getTime() - 300_000), completedAt: now, durationSeconds: 300 } },
      },
    });
    await db!.pipelineRun.create({ data: { ...common, changeName: 'untrusted-change', fingerprintVerified: false, contentHash: 'b'.repeat(32), commitSha: 'b'.repeat(40) } });

    const overview = await new MetricsService(db!).overview([developer.id]);
    expect(overview).toMatchObject({ totalRuns: 1, completedRuns: 1, completionRate: 1, avgCycleTimeMinutes: 10, reviewPassRate: 1, testFirstPassRate: 1 });
    expect(overview.phaseBreakdown.find((entry) => entry.phase === 2)).toMatchObject({ count: 1, avgSec: 300 });
  });
});

afterAll(async () => {
  if (repoId) await db!.repo.delete({ where: { id: repoId } });
  if (developerId) await db!.developer.delete({ where: { id: developerId } });
  await db?.$disconnect();
});
