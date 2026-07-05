import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  logDecision,
  readDecisions,
  getDecisionStats,
  findSimilarDecisions,
} from '../../src/core/hermes/decision-logger.js';
import type { DecisionRecord } from '../../src/core/hermes/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

function makeDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: '1',
    phase: 'phase1_propose',
    type: 'B',
    context: '确认提案内容',
    choice: 'confirm',
    reason: '提案符合需求',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('decision-logger', () => {
  describe('logDecision and readDecisions', () => {
    it('returns empty array when no decisions logged', async () => {
      const dir = await createTempDir('opsx-decisions-empty-');
      const decisions = await readDecisions(dir);
      expect(decisions).toEqual([]);
    });

    it('logs and reads a single decision', async () => {
      const dir = await createTempDir('opsx-decisions-single-');
      const decision = makeDecision();

      await logDecision(dir, decision);
      const decisions = await readDecisions(dir);

      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.id).toBe('1');
      expect(decisions[0]!.phase).toBe('phase1_propose');
      expect(decisions[0]!.type).toBe('B');
      expect(decisions[0]!.choice).toBe('confirm');
      expect(decisions[0]!.reason).toBe('提案符合需求');
    });

    it('logs and reads multiple decisions', async () => {
      const dir = await createTempDir('opsx-decisions-multi-');
      await logDecision(dir, makeDecision({ id: '1', phase: 'phase1_propose' }));
      await logDecision(dir, makeDecision({ id: '2', phase: 'phase2_apply', type: 'A' }));
      await logDecision(dir, makeDecision({ id: '3', phase: 'phase2_apply', type: 'B' }));

      const decisions = await readDecisions(dir);
      expect(decisions).toHaveLength(3);
    });
  });

  describe('readDecisions with filters', () => {
    it('filters by phase', async () => {
      const dir = await createTempDir('opsx-decisions-filter-phase-');
      await logDecision(dir, makeDecision({ id: '1', phase: 'phase1_propose' }));
      await logDecision(dir, makeDecision({ id: '2', phase: 'phase2_apply' }));
      await logDecision(dir, makeDecision({ id: '3', phase: 'phase2_apply' }));

      const filtered = await readDecisions(dir, { phase: 'phase2_apply' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((d) => d.phase === 'phase2_apply')).toBe(true);
    });

    it('filters by type', async () => {
      const dir = await createTempDir('opsx-decisions-filter-type-');
      await logDecision(dir, makeDecision({ id: '1', type: 'A' }));
      await logDecision(dir, makeDecision({ id: '2', type: 'B' }));
      await logDecision(dir, makeDecision({ id: '3', type: 'B' }));

      const typeA = await readDecisions(dir, { type: 'A' });
      expect(typeA).toHaveLength(1);
      expect(typeA[0]!.id).toBe('1');

      const typeB = await readDecisions(dir, { type: 'B' });
      expect(typeB).toHaveLength(2);
    });

    it('filters by since timestamp', async () => {
      const dir = await createTempDir('opsx-decisions-filter-since-');
      const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const newDate = new Date().toISOString();

      await logDecision(dir, makeDecision({ id: 'old', timestamp: oldDate }));
      await logDecision(dir, makeDecision({ id: 'new', timestamp: newDate }));

      const recent = await readDecisions(dir, {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(recent).toHaveLength(1);
      expect(recent[0]!.id).toBe('new');
    });

    it('combines multiple filters', async () => {
      const dir = await createTempDir('opsx-decisions-filter-multi-');
      await logDecision(dir, makeDecision({ id: '1', phase: 'phase1_propose', type: 'A' }));
      await logDecision(dir, makeDecision({ id: '2', phase: 'phase2_apply', type: 'B' }));
      await logDecision(dir, makeDecision({ id: '3', phase: 'phase2_apply', type: 'B' }));

      const filtered = await readDecisions(dir, {
        phase: 'phase2_apply',
        type: 'B',
      });
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getDecisionStats', () => {
    it('returns stats for logged decisions', async () => {
      const dir = await createTempDir('opsx-decisions-stats-');
      await logDecision(dir, makeDecision({ id: '1', phase: 'phase1_propose', type: 'B' }));
      await logDecision(dir, makeDecision({ id: '2', phase: 'phase2_apply', type: 'A' }));
      await logDecision(dir, makeDecision({ id: '3', phase: 'phase2_apply', type: 'B' }));

      const stats = await getDecisionStats(dir, 365);

      expect(stats.total).toBe(3);
      expect(stats.byPhase['phase1_propose']).toBe(1);
      expect(stats.byPhase['phase2_apply']).toBe(2);
      expect(stats.byType['A']).toBe(1);
      expect(stats.byType['B']).toBe(2);
    });

    it('returns zeros for empty decisions', async () => {
      const dir = await createTempDir('opsx-decisions-stats-empty-');
      const stats = await getDecisionStats(dir);

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byPhase)).toHaveLength(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
    });
  });

  describe('findSimilarDecisions', () => {
    it('returns empty when no decisions exist', async () => {
      const dir = await createTempDir('opsx-decisions-similar-empty-');
      const similar = await findSimilarDecisions(dir, 'any context');

      expect(similar).toEqual([]);
    });

    it('finds decisions with overlapping keywords', async () => {
      const dir = await createTempDir('opsx-decisions-similar-');
      await logDecision(
        dir,
        makeDecision({
          id: '1',
          context: '创建 REST API endpoint 需要确认认证方式',
          choice: 'JWT',
          reason: '使用现有的 JWT 中间件',
        }),
      );
      await logDecision(
        dir,
        makeDecision({
          id: '2',
          context: '选择数据库连接池大小',
          choice: '20',
          reason: '根据负载测试结果',
        }),
      );
      await logDecision(
        dir,
        makeDecision({
          id: '3',
          context: '确认 API 版本策略',
          choice: 'URL versioning',
          reason: 'REST API 版本通过 URL 前缀管理',
        }),
      );

      const similar = await findSimilarDecisions(dir, 'REST API 认证 endpoint', 5);
      expect(similar.length).toBeGreaterThan(0);
      // The first match should be decision id '1' about REST API endpoint
      const foundIds = similar.map((s) => s.decision.id);
      expect(foundIds).toContain('1');
    });

    it('respects limit parameter', async () => {
      const dir = await createTempDir('opsx-decisions-similar-limit-');
      for (let i = 0; i < 10; i++) {
        await logDecision(
          dir,
          makeDecision({
            id: `${i}`,
            context: `test context keyword common ${i}`,
          }),
        );
      }

      const similar = await findSimilarDecisions(dir, 'keyword common', 3);
      expect(similar.length).toBeLessThanOrEqual(3);
    });
  });
});