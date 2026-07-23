import fs from 'fs-extra';
import path from 'node:path';
import type {
  KnowledgeHealthDimensionDelta,
  KnowledgeHealthReport,
  KnowledgeHealthTrend,
} from './types.js';

const historyDir = path.join('.knowledge', 'health-reports');

interface HealthSnapshot {
  date: string;
  generatedAt: string;
  value: number;
  grade: string;
  dimensions: Array<{ id: string; score: number }>;
}

function toSnapshot(report: KnowledgeHealthReport): HealthSnapshot | null {
  if (!report.score) {
    return null;
  }

  const generatedAt = report.generatedAt ?? new Date().toISOString();
  return {
    date: generatedAt.slice(0, 10),
    generatedAt,
    value: report.score.value,
    grade: report.score.grade,
    dimensions: report.score.dimensions.map((dimension) => ({
      id: dimension.id,
      score: dimension.score,
    })),
  };
}

async function readSnapshots(
  dirPath: string,
): Promise<Array<{ file: string; snapshot: HealthSnapshot }>> {
  if (!(await fs.pathExists(dirPath))) {
    return [];
  }

  const files = (await fs.readdir(dirPath))
    .filter((file) => file.startsWith('health-') && file.endsWith('.json'))
    .sort();

  const snapshots: Array<{ file: string; snapshot: HealthSnapshot }> = [];
  for (const file of files) {
    try {
      const snapshot = (await fs.readJson(path.join(dirPath, file))) as HealthSnapshot;
      if (snapshot && typeof snapshot.value === 'number') {
        snapshots.push({ file, snapshot });
      }
    } catch {
      // skip malformed snapshot
    }
  }

  return snapshots;
}

function computeTrend(
  current: HealthSnapshot,
  previous: HealthSnapshot | null,
): KnowledgeHealthTrend {
  if (!previous) {
    return {
      previousDate: null,
      previousValue: null,
      delta: null,
      dimensionDeltas: current.dimensions.map((dimension) => ({ id: dimension.id, delta: null })),
    };
  }

  const previousById = new Map(
    previous.dimensions.map((dimension) => [dimension.id, dimension.score]),
  );
  const dimensionDeltas: KnowledgeHealthDimensionDelta[] = current.dimensions.map((dimension) => {
    const before = previousById.get(dimension.id);
    return {
      id: dimension.id,
      delta: typeof before === 'number' ? dimension.score - before : null,
    };
  });

  return {
    previousDate: previous.date,
    previousValue: previous.value,
    delta: current.value - previous.value,
    dimensionDeltas,
  };
}

export async function applyKnowledgeHealthHistory(
  targetDir: string,
  report: KnowledgeHealthReport,
  options: { persist?: boolean } = {},
): Promise<KnowledgeHealthReport> {
  const current = toSnapshot(report);
  if (!current) {
    return report;
  }

  const dirPath = path.join(targetDir, historyDir);
  const existing = await readSnapshots(dirPath);
  const previousEntry = [...existing]
    .reverse()
    .find((entry) => entry.snapshot.date !== current.date);
  const trend = computeTrend(current, previousEntry?.snapshot ?? null);

  if (options.persist) {
    await fs.ensureDir(dirPath);
    await fs.writeJson(path.join(dirPath, `health-${current.date}.json`), current, { spaces: 2 });
  }

  return { ...report, trend };
}
