import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeSuccessRate,
  findSkillByKey,
  getRefinementCandidates,
  markExecution,
  querySkillMemory,
  readSkillMemory,
  upsertSkillEntry,
} from '../../src/core/hermes/skill-memory.js';
import type { SkillMemoryEntry } from '../../src/core/hermes/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

describe('skill-memory', () => {
  describe('readSkillMemory', () => {
    it('returns empty store when no file exists', async () => {
      const dir = await createTempDir('opsx-skill-empty-');
      const store = await readSkillMemory(dir);

      expect(store.entries).toEqual([]);
    });
  });

  describe('computeSuccessRate', () => {
    it('returns 0 for zero attempts', () => {
      const entry: SkillMemoryEntry = {
        key: 'test',
        pattern: 'test pattern',
        category: 'test',
        successCount: 0,
        failCount: 0,
        totalAttempts: 0,
        successRate: 0,
        lastUsedAt: new Date().toISOString(),
        lastRefinedAt: new Date().toISOString(),
        refinements: [],
        metadata: {},
      };

      expect(computeSuccessRate(entry)).toBe(0);
    });

    it('returns correct rate', () => {
      const entry: SkillMemoryEntry = {
        key: 'test',
        pattern: 'test pattern',
        category: 'test',
        successCount: 7,
        failCount: 3,
        totalAttempts: 10,
        successRate: 0,
        lastUsedAt: new Date().toISOString(),
        lastRefinedAt: new Date().toISOString(),
        refinements: [],
        metadata: {},
      };

      expect(computeSuccessRate(entry)).toBeCloseTo(0.7);
    });

    it('returns 1 for all successes', () => {
      const entry: SkillMemoryEntry = {
        key: 'test',
        pattern: 'test',
        category: 'test',
        successCount: 5,
        failCount: 0,
        totalAttempts: 5,
        successRate: 0,
        lastUsedAt: new Date().toISOString(),
        lastRefinedAt: new Date().toISOString(),
        refinements: [],
        metadata: {},
      };

      expect(computeSuccessRate(entry)).toBe(1);
    });
  });

  describe('upsertSkillEntry', () => {
    it('creates a new entry', async () => {
      const dir = await createTempDir('opsx-skill-upsert-new-');
      const entry = await upsertSkillEntry(dir, 'my-skill', {
        pattern: 'Do X in Y way',
        category: 'implementation',
      });

      expect(entry.key).toBe('my-skill');
      expect(entry.pattern).toBe('Do X in Y way');
      expect(entry.category).toBe('implementation');
      expect(entry.successCount).toBe(0);
      expect(entry.successRate).toBe(0);

      // Verify persistence
      const store = await readSkillMemory(dir);
      expect(store.entries).toHaveLength(1);
      expect(store.entries[0]!.key).toBe('my-skill');
    });

    it('updates an existing entry', async () => {
      const dir = await createTempDir('opsx-skill-upsert-update-');
      await upsertSkillEntry(dir, 'my-skill', {
        pattern: 'Old pattern',
        category: 'implementation',
      });

      const updated = await upsertSkillEntry(dir, 'my-skill', {
        pattern: 'New improved pattern',
        refinements: ['added validation'],
      });

      expect(updated.pattern).toBe('New improved pattern');
      expect(updated.refinements).toContain('added validation');
      expect(updated.category).toBe('implementation'); // preserved

      // Should still be one entry
      const store = await readSkillMemory(dir);
      expect(store.entries).toHaveLength(1);
    });

    it('auto-computes successRate on creation', async () => {
      const dir = await createTempDir('opsx-skill-upsert-rate-');
      const entry = await upsertSkillEntry(dir, 'rated-skill', {
        pattern: 'pattern',
        successCount: 8,
        totalAttempts: 10,
      });

      expect(entry.successRate).toBeCloseTo(0.8);
    });
  });

  describe('querySkillMemory', () => {
    it('returns all entries with no filter', async () => {
      const dir = await createTempDir('opsx-skill-query-all-');
      await upsertSkillEntry(dir, 'skill-1', { pattern: 'P1', category: 'cat-a' });
      await upsertSkillEntry(dir, 'skill-2', { pattern: 'P2', category: 'cat-b' });
      await upsertSkillEntry(dir, 'skill-3', { pattern: 'P3', category: 'cat-a' });

      const results = await querySkillMemory(dir);
      expect(results).toHaveLength(3);
    });

    it('filters by category', async () => {
      const dir = await createTempDir('opsx-skill-query-cat-');
      await upsertSkillEntry(dir, 'skill-1', { pattern: 'P1', category: 'cat-a' });
      await upsertSkillEntry(dir, 'skill-2', { pattern: 'P2', category: 'cat-b' });
      await upsertSkillEntry(dir, 'skill-3', { pattern: 'P3', category: 'cat-a' });

      const results = await querySkillMemory(dir, { category: 'cat-a' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.category === 'cat-a')).toBe(true);
    });

    it('filters by minSuccessRate', async () => {
      const dir = await createTempDir('opsx-skill-query-rate-');
      await upsertSkillEntry(dir, 'high', {
        pattern: 'P1',
        successCount: 9,
        totalAttempts: 10,
      });
      await upsertSkillEntry(dir, 'low', {
        pattern: 'P2',
        successCount: 2,
        totalAttempts: 10,
      });

      const results = await querySkillMemory(dir, { minSuccessRate: 0.8 });
      expect(results).toHaveLength(1);
      expect(results[0]!.key).toBe('high');
    });
  });

  describe('markExecution', () => {
    it('returns null for non-existent key', async () => {
      const dir = await createTempDir('opsx-skill-mark-missing-');
      const result = await markExecution(dir, 'nonexistent', true);
      expect(result).toBeNull();
    });

    it('increments success on successful execution', async () => {
      const dir = await createTempDir('opsx-skill-mark-success-');
      await upsertSkillEntry(dir, 'test-skill', {
        pattern: 'pattern',
        successCount: 3,
        totalAttempts: 5,
      });

      const updated = await markExecution(dir, 'test-skill', true);

      expect(updated).not.toBeNull();
      expect(updated!.successCount).toBe(4);
      expect(updated!.totalAttempts).toBe(6);
      expect(updated!.successRate).toBeCloseTo(4 / 6);
    });

    it('increments failCount on failed execution', async () => {
      const dir = await createTempDir('opsx-skill-mark-fail-');
      await upsertSkillEntry(dir, 'test-skill', {
        pattern: 'pattern',
        failCount: 1,
        totalAttempts: 4,
      });

      const updated = await markExecution(dir, 'test-skill', false);

      expect(updated).not.toBeNull();
      expect(updated!.failCount).toBe(2);
      expect(updated!.totalAttempts).toBe(5);
    });

    it('updates lastUsedAt', async () => {
      const dir = await createTempDir('opsx-skill-mark-time-');
      const before = new Date('2026-01-01').toISOString();
      await upsertSkillEntry(dir, 'test-skill', {
        pattern: 'pattern',
        lastUsedAt: before,
      });

      const updated = await markExecution(dir, 'test-skill', true);
      expect(updated!.lastUsedAt).not.toBe(before);
    });
  });

  describe('getRefinementCandidates', () => {
    it('returns entries needing refinement', async () => {
      const dir = await createTempDir('opsx-skill-refine-');
      await upsertSkillEntry(dir, 'good', {
        pattern: 'P1',
        successCount: 9,
        totalAttempts: 10,
      });
      await upsertSkillEntry(dir, 'bad', {
        pattern: 'P2',
        successCount: 1,
        totalAttempts: 5,
      });
      await upsertSkillEntry(dir, 'untested', {
        pattern: 'P3',
        successCount: 0,
        totalAttempts: 1,
      });

      const candidates = await getRefinementCandidates(dir, 3, 0.5);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.key).toBe('bad');
    });
  });

  describe('findSkillByKey', () => {
    it('returns null for non-existent key', async () => {
      const dir = await createTempDir('opsx-skill-find-missing-');
      const result = await findSkillByKey(dir, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns the matching entry', async () => {
      const dir = await createTempDir('opsx-skill-find-');
      await upsertSkillEntry(dir, 'target', { pattern: 'specific pattern' });
      await upsertSkillEntry(dir, 'other', { pattern: 'other pattern' });

      const result = await findSkillByKey(dir, 'target');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('target');
      expect(result!.pattern).toBe('specific pattern');
    });
  });
});