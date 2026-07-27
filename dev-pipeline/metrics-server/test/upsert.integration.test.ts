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
    machineInfo: { platform: 'darwin', hostname: 'test', osRelease: '1', nodeVersion: 'v24', arch: 'arm64' },
    featureInfo: null,
    fingerprintId: `fp1.${'A'.repeat(342)}`,
    fingerprintNonce: '1234abcd',
    phaseHistory: [{ phase: version, step: 1, executedBy: 'pipeline', status: 'completed', startedAt: '2026-07-28 01:00:00', completedAt: '2026-07-28 01:01:00', decisions: {}, gatesBypassed: [] }],
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
      data: { name: 'integration-upsert', gitUrl: 'https://example.invalid/repo.git', collectSince: new Date() },
    });
    repoId = repo.id;
    const v1 = makeState(1);
    const raw1 = JSON.stringify(v1);
    const first = await upsertSnapshot(db!, v1, verified, { repoId, commitSha: '1'.repeat(40), commitTimestamp: new Date(), rawContent: raw1 });
    expect(first.action).toBe('inserted');
    expect((await upsertSnapshot(db!, v1, verified, { repoId, commitSha: '1'.repeat(40), commitTimestamp: new Date(), rawContent: raw1 })).action).toBe('skipped');

    const v2 = makeState(2);
    expect((await upsertSnapshot(db!, v2, verified, { repoId, commitSha: '2'.repeat(40), commitTimestamp: new Date(), rawContent: JSON.stringify(v2) })).action).toBe('inserted');
    const rows = await db!.pipelineRun.findMany({ where: { repoId }, orderBy: { stateVersion: 'asc' }, select: { stateVersion: true, isLatest: true, phaseHistory: true } });
    expect(rows.map(({ stateVersion, isLatest }) => ({ stateVersion, isLatest }))).toEqual([{ stateVersion: 1, isLatest: false }, { stateVersion: 2, isLatest: true }]);
    expect(rows[1]?.phaseHistory).toHaveLength(1);
  });
});

afterAll(async () => {
  if (repoId) await db!.repo.delete({ where: { id: repoId } });
  if (db) await db.developer.deleteMany({ where: { email: 'integration@example.invalid' } });
  await db?.$disconnect();
});
