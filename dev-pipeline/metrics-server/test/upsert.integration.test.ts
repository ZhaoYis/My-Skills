import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import type { FingerprintResult } from '../src/collectors/fingerprint-verifier.js';
import type { PipelineState } from '../src/collectors/state-parser.js';
import { upsertSnapshot } from '../src/collectors/upsert-engine.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
let repoId: number | undefined;

function makeState(version: number): PipelineState {
  return {
    schemaVersion: 3,
    _version: version,
    changeName: 'integration-upsert',
    sourceBranch: 'feature/integration-upsert',
    targetBranch: 'main',
    currentPhase: version,
    currentStep: 1,
    status: 'active',
    executionMode: 'pipeline',
    createdBy: 'Integration Tester',
    createdByEmail: 'integration@example.invalid',
    machineInfo: {
      platform: 'darwin',
      hostname: 'test',
      osRelease: '1',
      nodeVersion: 'v24',
      arch: 'arm64',
    },
    featureInfo: null,
    fingerprintId: `fp1.${'A'.repeat(342)}`,
    fingerprintNonce: '1234abcd',
    phaseHistory: [
      {
        phase: version,
        step: 1,
        executedBy: 'pipeline',
        status: 'completed',
        startedAt: '2026-07-28 01:00:00',
        completedAt: '2026-07-28 01:01:00',
        decisions: {},
        gatesBypassed: [],
      },
    ],
    gatesBypassed: [],
    decisions: {},
    review: { currentRound: 0, rounds: [], reportPath: null, status: 'pending' },
    tests: { command: null, attempts: 0, status: 'pending', detail: null },
    verify: { command: null, attempts: 0, status: 'pending', detail: null },
    archivePath: null,
    delivery: {},
    createdAt: '2026-07-28 01:00:00',
    updatedAt: `2026-07-28 01:0${version}:00`,
  };
}

describe.runIf(enabled)('PostgreSQL snapshot transaction', () => {
  const verified: FingerprintResult = { verified: true, keyVersion: 'fp1' };

  it('deduplicates content and preserves only the newest stateVersion as latest', async () => {
    const repo = await db!.repo.create({
      data: {
        name: 'integration-upsert',
        gitUrl: 'https://example.invalid/repo.git',
        collectSince: new Date(),
      },
    });
    repoId = repo.id;
    const v1 = makeState(1);
    const raw1 = JSON.stringify(v1);
    const first = await upsertSnapshot(db!, v1, verified, {
      repoId,
      commitSha: '1'.repeat(40),
      commitTimestamp: new Date(),
      rawContent: raw1,
    });
    expect(first.action).toBe('inserted');
    expect(
      (
        await upsertSnapshot(db!, v1, verified, {
          repoId,
          commitSha: '1'.repeat(40),
          commitTimestamp: new Date(),
          rawContent: raw1,
        })
      ).action,
    ).toBe('skipped');

    const v2 = makeState(2);
    expect(
      (
        await upsertSnapshot(db!, v2, verified, {
          repoId,
          commitSha: '2'.repeat(40),
          commitTimestamp: new Date(),
          rawContent: JSON.stringify(v2),
        })
      ).action,
    ).toBe('inserted');
    const rows = await db!.pipelineRun.findMany({
      where: { repoId },
      orderBy: { stateVersion: 'asc' },
      select: { stateVersion: true, isLatest: true, phaseHistory: true },
    });
    expect(rows.map(({ stateVersion, isLatest }) => ({ stateVersion, isLatest }))).toEqual([
      { stateVersion: 1, isLatest: false },
      { stateVersion: 2, isLatest: true },
    ]);
    expect(rows[1]?.phaseHistory).toHaveLength(1);
  }, 60_000);

  it('keeps a trusted latest snapshot when a legacy history snapshot arrives', async () => {
    const trusted = makeState(4);
    trusted.changeName = 'integration-trusted-chain';
    await upsertSnapshot(db!, trusted, verified, {
      repoId: repoId!,
      commitSha: '4'.repeat(40),
      commitTimestamp: new Date(),
      rawContent: JSON.stringify(trusted),
    });

    const legacy = makeState(5);
    legacy.changeName = trusted.changeName;
    legacy.fingerprintId = 'a'.repeat(32);
    const legacyFingerprint: FingerprintResult = {
      verified: false,
      keyVersion: 'legacy',
      reason: 'legacy-unverified',
    };
    await expect(
      upsertSnapshot(db!, legacy, legacyFingerprint, {
        repoId: repoId!,
        commitSha: '5'.repeat(40),
        commitTimestamp: new Date(),
        rawContent: JSON.stringify(legacy),
      }),
    ).rejects.toThrow('requires history import mode');

    await upsertSnapshot(db!, legacy, legacyFingerprint, {
      repoId: repoId!,
      commitSha: '5'.repeat(40),
      commitTimestamp: new Date(),
      rawContent: JSON.stringify(legacy),
      source: 'history-import',
    });
    const rows = await db!.pipelineRun.findMany({
      where: { repoId: repoId!, changeName: trusted.changeName },
      orderBy: { stateVersion: 'asc' },
      select: {
        stateVersion: true,
        isLatest: true,
        isLatestHistorical: true,
        snapshotSource: true,
      },
    });
    expect(rows).toEqual([
      { stateVersion: 4, isLatest: true, isLatestHistorical: false, snapshotSource: 'collector' },
      {
        stateVersion: 5,
        isLatest: false,
        isLatestHistorical: true,
        snapshotSource: 'history-import',
      },
    ]);
  }, 60_000);

  it('records completion once and preserves it across later completed snapshots', async () => {
    const active = makeState(6);
    active.changeName = 'integration-completion-time';
    await upsertSnapshot(db!, active, verified, {
      repoId: repoId!,
      commitSha: '6'.repeat(40),
      commitTimestamp: new Date(),
      rawContent: JSON.stringify(active),
    });
    const activeRow = await db!.pipelineRun.findFirstOrThrow({
      where: { repoId: repoId!, changeName: active.changeName, isLatest: true },
    });
    expect(activeRow).toMatchObject({ completedAtPipeline: null, changeDurationSeconds: null });

    const completed = makeState(7);
    completed.changeName = active.changeName;
    completed.status = 'completed';
    completed.updatedAt = '2026-07-28 02:00:00';
    await upsertSnapshot(db!, completed, verified, {
      repoId: repoId!,
      commitSha: '7'.repeat(40),
      commitTimestamp: new Date(),
      rawContent: JSON.stringify(completed),
    });
    const firstCompletion = await db!.pipelineRun.findFirstOrThrow({
      where: { repoId: repoId!, changeName: active.changeName, isLatest: true },
    });
    expect(firstCompletion.completedAtPipeline?.toISOString()).toBe('2026-07-28T02:00:00.000Z');

    const recollected = makeState(8);
    recollected.changeName = active.changeName;
    recollected.status = 'completed';
    recollected.updatedAt = '2026-08-03 03:00:00';
    await upsertSnapshot(db!, recollected, verified, {
      repoId: repoId!,
      commitSha: '8'.repeat(40),
      commitTimestamp: new Date(),
      rawContent: JSON.stringify(recollected),
    });
    const latest = await db!.pipelineRun.findFirstOrThrow({
      where: { repoId: repoId!, changeName: active.changeName, isLatest: true },
    });
    expect(latest.completedAtPipeline).toEqual(firstCompletion.completedAtPipeline);
  }, 60_000);
});

afterAll(async () => {
  if (repoId) await db!.repo.delete({ where: { id: repoId } });
  if (db) await db.developer.deleteMany({ where: { email: 'integration@example.invalid' } });
  await db?.$disconnect();
});
