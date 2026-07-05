import fs from 'fs-extra';
import path from 'node:path';
import { HERMES_DECISIONS_FILE } from '../runtime/meta.js';
import type { DecisionRecord, PipelinePhase } from './types.js';

// ── Read / Write ──

async function readDecisionLines(targetDir: string): Promise<DecisionRecord[]> {
  const filePath = path.join(targetDir, HERMES_DECISIONS_FILE);
  if (!(await fs.pathExists(filePath))) {
    return [];
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content
    .split('\n')
    .filter((line) => line.trim().length > 0);

  const decisions: DecisionRecord[] = [];
  for (const line of lines) {
    try {
      decisions.push(JSON.parse(line) as DecisionRecord);
    } catch {
      // skip malformed lines
    }
  }

  return decisions;
}

// ── Log Decision ──

export async function logDecision(
  targetDir: string,
  decision: DecisionRecord,
): Promise<void> {
  const filePath = path.join(targetDir, HERMES_DECISIONS_FILE);
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, JSON.stringify(decision) + '\n', 'utf-8');
}

// ── Read Decisions ──

export interface DecisionFilters {
  phase?: PipelinePhase;
  type?: string;
  since?: string;
}

export async function readDecisions(
  targetDir: string,
  filters?: DecisionFilters,
): Promise<DecisionRecord[]> {
  let decisions = await readDecisionLines(targetDir);

  if (filters?.phase) {
    decisions = decisions.filter((d) => d.phase === filters.phase);
  }
  if (filters?.type) {
    decisions = decisions.filter((d) => d.type === filters.type);
  }
  if (filters?.since) {
    decisions = decisions.filter((d) => d.timestamp >= filters.since!);
  }

  return decisions;
}

// ── Get Decision Stats ──

export interface DecisionStats {
  total: number;
  byPhase: Record<string, number>;
  byType: Record<string, number>;
  recentSuccessCount: number;
  recentTotal: number;
}

export async function getDecisionStats(
  targetDir: string,
  recentDays = 7,
): Promise<DecisionStats> {
  const all = await readDecisionLines(targetDir);
  const recentThreshold = new Date(
    Date.now() - recentDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const byPhase: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let recentSuccessCount = 0;
  let recentTotal = 0;

  for (const d of all) {
    byPhase[d.phase] = (byPhase[d.phase] ?? 0) + 1;
    byType[d.type] = (byType[d.type] ?? 0) + 1;

    if (d.timestamp >= recentThreshold) {
      recentTotal++;
      // A "successful" decision is one that moved forward (not terminated)
      if (d.choice !== 'terminate' && d.choice !== 'abort') {
        recentSuccessCount++;
      }
    }
  }

  return {
    total: all.length,
    byPhase,
    byType,
    recentSuccessCount,
    recentTotal,
  };
}

// ── Find Similar Decisions ──

export interface SimilarDecisionResult {
  decision: DecisionRecord;
  relevance: number;
}

export async function findSimilarDecisions(
  targetDir: string,
  context: string,
  limit = 5,
): Promise<SimilarDecisionResult[]> {
  const all = await readDecisionLines(targetDir);

  if (all.length === 0) {
    return [];
  }

  // Simple keyword overlap relevance
  const contextWords = new Set(
    context
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

  const scored = all
    .map((decision) => {
      const decisionText = `${decision.context} ${decision.choice} ${decision.reason ?? ''}`.toLowerCase();
      const decisionWords = decisionText.split(/\s+/);
      const overlap = decisionWords.filter((w) => contextWords.has(w)).length;
      const relevance =
        contextWords.size > 0 ? overlap / contextWords.size : 0;
      return { decision, relevance };
    })
    .filter((s) => s.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);

  return scored.slice(0, limit);
}