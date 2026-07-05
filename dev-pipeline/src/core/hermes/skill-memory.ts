import fs from 'fs-extra';
import path from 'node:path';
import { HERMES_SKILL_MEMORY_FILE } from '../runtime/meta.js';
import type { SkillMemoryEntry, SkillMemoryStore } from './types.js';

// ── Read / Write ──

export async function readSkillMemory(
  targetDir: string,
): Promise<SkillMemoryStore> {
  const filePath = path.join(targetDir, HERMES_SKILL_MEMORY_FILE);
  if (!(await fs.pathExists(filePath))) {
    return { entries: [] };
  }
  return fs.readJson(filePath) as Promise<SkillMemoryStore>;
}

export async function writeSkillMemory(
  targetDir: string,
  store: SkillMemoryStore,
): Promise<void> {
  const filePath = path.join(targetDir, HERMES_SKILL_MEMORY_FILE);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, store, { spaces: 2 });
}

// ── Compute Success Rate ──

export function computeSuccessRate(entry: SkillMemoryEntry): number {
  if (entry.totalAttempts === 0) {
    return 0;
  }
  return entry.successCount / entry.totalAttempts;
}

// ── Upsert Skill Entry ──

export async function upsertSkillEntry(
  targetDir: string,
  key: string,
  updates: Partial<Omit<SkillMemoryEntry, 'key' | 'successRate'>>,
): Promise<SkillMemoryEntry> {
  const store = await readSkillMemory(targetDir);
  const existing = store.entries.find((e) => e.key === key);

  const now = new Date().toISOString();

  if (existing) {
    const updated: SkillMemoryEntry = {
      ...existing,
      ...updates,
      lastRefinedAt: updates.pattern !== undefined ? now : existing.lastRefinedAt,
      successRate: computeSuccessRate({
        ...existing,
        ...updates,
        successRate: 0,
      }),
    };
    store.entries = store.entries.map((e) => (e.key === key ? updated : e));
    await writeSkillMemory(targetDir, store);
    return updated;
  }

  const entry: SkillMemoryEntry = {
    key,
    pattern: updates.pattern ?? '',
    category: updates.category ?? 'general',
    successCount: updates.successCount ?? 0,
    failCount: updates.failCount ?? 0,
    totalAttempts: updates.totalAttempts ?? 0,
    successRate: 0,
    lastUsedAt: updates.lastUsedAt ?? now,
    lastRefinedAt: now,
    refinements: updates.refinements ?? [],
    metadata: updates.metadata ?? {},
  };
  entry.successRate = computeSuccessRate(entry);

  store.entries.push(entry);
  await writeSkillMemory(targetDir, store);
  return entry;
}

// ── Query Skill Memory ──

export interface SkillMemoryQuery {
  category?: string;
  minSuccessRate?: number;
}

export async function querySkillMemory(
  targetDir: string,
  query?: SkillMemoryQuery,
): Promise<SkillMemoryEntry[]> {
  const store = await readSkillMemory(targetDir);
  let results = store.entries;

  if (query?.category) {
    results = results.filter((e) => e.category === query.category);
  }
  if (query?.minSuccessRate !== undefined) {
    results = results.filter(
      (e) => computeSuccessRate(e) >= query.minSuccessRate!,
    );
  }

  return results;
}

// ── Mark Execution ──

export async function markExecution(
  targetDir: string,
  key: string,
  success: boolean,
): Promise<SkillMemoryEntry | null> {
  const store = await readSkillMemory(targetDir);
  const entry = store.entries.find((e) => e.key === key);

  if (!entry) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: SkillMemoryEntry = {
    ...entry,
    successCount: entry.successCount + (success ? 1 : 0),
    failCount: entry.failCount + (success ? 0 : 1),
    totalAttempts: entry.totalAttempts + 1,
    lastUsedAt: now,
  };
  updated.successRate = computeSuccessRate(updated);

  store.entries = store.entries.map((e) => (e.key === key ? updated : e));
  await writeSkillMemory(targetDir, store);
  return updated;
}

// ── Get Refinement Candidates ──

export async function getRefinementCandidates(
  targetDir: string,
  minAttempts: number,
  maxSuccessRate: number,
): Promise<SkillMemoryEntry[]> {
  const store = await readSkillMemory(targetDir);
  return store.entries.filter(
    (e) =>
      e.totalAttempts >= minAttempts &&
      computeSuccessRate(e) <= maxSuccessRate,
  );
}

// ── Find by Key ──

export async function findSkillByKey(
  targetDir: string,
  key: string,
): Promise<SkillMemoryEntry | null> {
  const store = await readSkillMemory(targetDir);
  return store.entries.find((e) => e.key === key) ?? null;
}