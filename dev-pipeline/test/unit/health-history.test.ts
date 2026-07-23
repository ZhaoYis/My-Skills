import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyKnowledgeHealthHistory } from '../../src/core/doctor/healthHistory.js';
import type { KnowledgeHealthReport } from '../../src/core/doctor/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

function buildReport(value: number, dimensionScore = value): KnowledgeHealthReport {
  return {
    status: 'ok',
    rootPath: '.knowledge',
    checks: [],
    summary: { ok: 1, warn: 0, fail: 0 },
    generatedAt: new Date().toISOString(),
    score: {
      value,
      grade: value >= 80 ? 'healthy' : value >= 60 ? 'fair' : 'attention',
      dimensions: [
        { id: 'anchors', label: '结构锚点完整度', weight: 20, score: dimensionScore, status: 'ok' },
      ],
    },
  };
}

describe('applyKnowledgeHealthHistory', () => {
  it('records a baseline snapshot when no history exists', async () => {
    const dir = await createTempDir('opsx-health-history-baseline-');
    const report = buildReport(90);

    const result = await applyKnowledgeHealthHistory(dir, report, { persist: true });

    expect(result.trend?.previousValue).toBeNull();
    expect(result.trend?.delta).toBeNull();

    const snapshotDir = path.join(dir, '.knowledge/health-reports');
    const files = await fs.readdir(snapshotDir);
    expect(files.some((file) => file.startsWith('health-') && file.endsWith('.json'))).toBe(true);
  });

  it('computes the delta against the most recent prior snapshot', async () => {
    const dir = await createTempDir('opsx-health-history-delta-');
    const snapshotDir = path.join(dir, '.knowledge/health-reports');
    await fs.ensureDir(snapshotDir);
    await fs.writeJson(path.join(snapshotDir, 'health-2000-01-01.json'), {
      date: '2000-01-01',
      generatedAt: '2000-01-01T00:00:00.000Z',
      value: 50,
      grade: 'attention',
      dimensions: [{ id: 'anchors', score: 50 }],
    });

    const result = await applyKnowledgeHealthHistory(dir, buildReport(90), { persist: false });

    expect(result.trend?.previousValue).toBe(50);
    expect(result.trend?.previousDate).toBe('2000-01-01');
    expect(result.trend?.delta).toBe(40);
    expect(result.trend?.dimensionDeltas.find((d) => d.id === 'anchors')?.delta).toBe(40);
  });

  it('returns the report unchanged when there is no score', async () => {
    const dir = await createTempDir('opsx-health-history-noscore-');
    const report: KnowledgeHealthReport = {
      status: 'warn',
      rootPath: '.knowledge',
      checks: [],
      summary: { ok: 0, warn: 1, fail: 0 },
    };

    const result = await applyKnowledgeHealthHistory(dir, report, { persist: true });
    expect(result.trend).toBeUndefined();
    expect(await fs.pathExists(path.join(dir, '.knowledge/health-reports'))).toBe(false);
  });
});
