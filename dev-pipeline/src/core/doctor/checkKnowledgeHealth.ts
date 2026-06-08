import fs from 'fs-extra';
import path from 'node:path';
import type { ManagedAssetRecord } from '../manifest/types.js';
import type {
  HealthCheckResult,
  HealthGrade,
  HealthStatus,
  KnowledgeHealthReport,
  KnowledgeHealthScore,
  KnowledgeHealthScoreDimension
} from './types.js';

const knowledgeRoot = '.knowledge';
const DEFAULT_STALE_DAYS = 90;
const linkExtensions = ['.md', '.sql', '.yaml', '.yml'];

const requiredFiles = [
  'README.md',
  'INDEX.md',
  'project/README.md',
  'business/README.md',
  'tech/README.md',
  'ops/README.md',
  'risks/README.md'
] as const;
const requiredDirectories = ['config', 'tech/api', 'tech/db'] as const;
const requiredIndexSections = [
  'API 路径索引',
  '功能域索引',
  '数据模型 / 表索引',
  '外部服务索引',
  '风险 / 故障索引',
  '运维知识索引',
  '开发规范 / 工作流'
] as const;

export interface KnowledgeHealthOptions {
  staleDays?: number;
}

function summarize(checks: HealthCheckResult[]): KnowledgeHealthReport['summary'] {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { ok: 0, warn: 0, fail: 0 }
  );
}

function overallStatus(checks: HealthCheckResult[]): HealthStatus {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }

  if (checks.some((check) => check.status === 'warn')) {
    return 'warn';
  }

  return 'ok';
}

function gradeFromValue(value: number): HealthGrade {
  if (value >= 80) {
    return 'healthy';
  }

  if (value >= 60) {
    return 'fair';
  }

  return 'attention';
}

function dimensionStatus(score: number): HealthStatus {
  if (score >= 80) {
    return 'ok';
  }

  if (score >= 60) {
    return 'warn';
  }

  return 'fail';
}

function computeScore(dimensions: KnowledgeHealthScoreDimension[]): KnowledgeHealthScore {
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const weighted = dimensions.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0);
  const value = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;

  return {
    value,
    grade: gradeFromValue(value),
    dimensions
  };
}

async function listKnowledgeFiles(rootPath: string): Promise<string[]> {
  if (!(await fs.pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { recursive: true });
  const relativePaths = entries.filter((entry): entry is string => typeof entry === 'string');
  const files: string[] = [];

  for (const relativePath of relativePaths) {
    const absolute = path.join(rootPath, relativePath);
    try {
      const stats = await fs.stat(absolute);
      if (stats.isFile()) {
        files.push(relativePath);
      }
    } catch {
      // ignore unreadable entries
    }
  }

  return files;
}

function countKnowledgeDocuments(files: string[]): number {
  return files
    .filter((entry) => entry.endsWith('.md'))
    .filter((entry) => path.basename(entry) !== 'README.md')
    .length;
}

function extractIndexReferences(content: string): string[] {
  const references = new Set<string>();

  const markdownLink = /\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownLink.exec(content)) !== null) {
    references.add(match[1]);
  }

  const inlineCode = /`([^`]+)`/g;
  while ((match = inlineCode.exec(content)) !== null) {
    references.add(match[1]);
  }

  return [...references]
    .map((reference) => reference.trim())
    .map((reference) => reference.split('#')[0])
    .map((reference) => reference.split('?')[0])
    .map((reference) => reference.trim())
    .filter((reference) => reference.length > 0)
    .filter((reference) => !/^[a-z][a-z0-9+.-]*:\/\//i.test(reference))
    .filter((reference) => !reference.startsWith('#'))
    .filter((reference) => linkExtensions.includes(path.extname(reference).toLowerCase()));
}

async function detectBrokenLinks(
  indexContent: string,
  rootPath: string,
  targetDir: string
): Promise<string[]> {
  const references = extractIndexReferences(indexContent);
  const broken: string[] = [];

  for (const reference of references) {
    const normalized = reference.replace(/^\.\//, '');
    const candidates = path.isAbsolute(reference)
      ? [reference]
      : [
          path.join(rootPath, normalized),
          path.join(targetDir, normalized)
        ];

    let exists = false;
    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      broken.push(reference);
    }
  }

  return broken;
}

function detectDuplicates(files: string[]): string[] {
  const byBaseName = new Map<string, string[]>();

  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue;
    }

    const baseName = path.basename(file);
    if (baseName === 'README.md') {
      continue;
    }

    const existing = byBaseName.get(baseName) ?? [];
    existing.push(file);
    byBaseName.set(baseName, existing);
  }

  const duplicates: string[] = [];
  for (const [, paths] of byBaseName) {
    if (paths.length > 1) {
      duplicates.push(...paths.sort());
    }
  }

  return duplicates.sort();
}

async function detectStaleFiles(
  files: string[],
  rootPath: string,
  staleDays: number,
  now: number
): Promise<string[]> {
  const stale: string[] = [];
  const thresholdMs = staleDays * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue;
    }

    if (path.basename(file) === 'README.md') {
      continue;
    }

    try {
      const stats = await fs.stat(path.join(rootPath, file));
      if (now - stats.mtimeMs > thresholdMs) {
        stale.push(file);
      }
    } catch {
      // ignore unreadable entries
    }
  }

  return stale.sort();
}

export async function checkKnowledgeHealth(
  targetDir: string,
  managedAssets: ManagedAssetRecord[] = [],
  options: KnowledgeHealthOptions = {}
): Promise<KnowledgeHealthReport> {
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const rootPath = path.join(targetDir, knowledgeRoot);
  const checks: HealthCheckResult[] = [];
  const knowledgeManaged = managedAssets.some((asset) => asset.id.startsWith('common-knowledge-skeleton:'));
  const rootExists = await fs.pathExists(rootPath);

  if (!rootExists) {
    checks.push({
      id: 'knowledge-directory-exists',
      status: knowledgeManaged ? 'warn' : 'ok',
      message: knowledgeManaged
        ? '.knowledge directory is missing even though knowledge skeleton assets are managed.'
        : '.knowledge directory is not present.',
      path: rootPath
    });

    return {
      status: overallStatus(checks),
      rootPath,
      checks,
      summary: summarize(checks),
      generatedAt
    };
  }

  checks.push({
    id: 'knowledge-directory-exists',
    status: 'ok',
    message: '.knowledge directory exists.',
    path: rootPath
  });

  const missingFiles: string[] = [];
  for (const relativePath of requiredFiles) {
    if (!(await fs.pathExists(path.join(rootPath, relativePath)))) {
      missingFiles.push(relativePath);
    }
  }

  for (const relativePath of requiredDirectories) {
    if (!(await fs.pathExists(path.join(rootPath, relativePath)))) {
      missingFiles.push(relativePath);
    }
  }

  const totalAnchors = requiredFiles.length + requiredDirectories.length;
  checks.push({
    id: 'knowledge-required-anchors',
    status: missingFiles.length > 0 ? 'warn' : 'ok',
    message: missingFiles.length > 0
      ? 'Some expected .knowledge anchor files or directories are missing.'
      : 'Expected .knowledge anchor files and directories are present.',
    path: rootPath,
    missingFiles: missingFiles.length > 0 ? missingFiles : undefined
  });

  const knowledgeFiles = await listKnowledgeFiles(rootPath);
  const knowledgeDocumentCount = countKnowledgeDocuments(knowledgeFiles);

  const indexPath = path.join(rootPath, 'INDEX.md');
  let missingSections: string[] = requiredIndexSections.slice();
  let placeholderCount = 0;
  let brokenLinks: string[] = [];
  let indexExists = false;

  if (await fs.pathExists(indexPath)) {
    indexExists = true;
    const content = await fs.readFile(indexPath, 'utf8');
    missingSections = requiredIndexSections.filter((section) => !content.includes(section));
    placeholderCount = (content.match(/待补充/g) ?? []).length;
    brokenLinks = await detectBrokenLinks(content, rootPath, targetDir);

    checks.push({
      id: 'knowledge-index-sections',
      status: missingSections.length > 0 ? 'warn' : 'ok',
      message: missingSections.length > 0
        ? 'INDEX.md is missing expected sections.'
        : 'INDEX.md contains the expected section anchors.',
      path: indexPath,
      missingSections: missingSections.length > 0 ? missingSections : undefined
    });

    const placeholderWarn = placeholderCount >= 4 && knowledgeDocumentCount > 3;
    checks.push({
      id: 'knowledge-index-placeholders',
      status: placeholderWarn ? 'warn' : 'ok',
      message: placeholderWarn
        ? 'INDEX.md still contains many placeholder rows and may need maintenance.'
        : 'INDEX.md placeholder usage looks reasonable for the current knowledge set.',
      path: indexPath,
      placeholderCount
    });

    checks.push({
      id: 'knowledge-index-broken-links',
      status: brokenLinks.length > 0 ? 'warn' : 'ok',
      message: brokenLinks.length > 0
        ? 'INDEX.md references knowledge files that do not exist.'
        : 'INDEX.md references resolve to existing files.',
      path: indexPath,
      brokenLinks: brokenLinks.length > 0 ? brokenLinks : undefined
    });
  } else {
    checks.push({
      id: 'knowledge-index-sections',
      status: 'warn',
      message: 'INDEX.md is missing, so index section health cannot be checked.',
      path: indexPath,
      missingFiles: ['INDEX.md']
    });
  }

  const duplicateFiles = detectDuplicates(knowledgeFiles);
  checks.push({
    id: 'knowledge-duplicate-files',
    status: duplicateFiles.length > 0 ? 'warn' : 'ok',
    message: duplicateFiles.length > 0
      ? 'Multiple knowledge files share the same name in different directories.'
      : 'No duplicate knowledge file names detected.',
    path: rootPath,
    duplicateFiles: duplicateFiles.length > 0 ? duplicateFiles : undefined
  });

  const staleFiles = await detectStaleFiles(knowledgeFiles, rootPath, staleDays, now);
  checks.push({
    id: 'knowledge-aging',
    status: staleFiles.length > 0 ? 'warn' : 'ok',
    message: staleFiles.length > 0
      ? `Some knowledge files have not been updated in more than ${staleDays} days.`
      : 'No stale knowledge files detected.',
    path: rootPath,
    staleFiles: staleFiles.length > 0 ? staleFiles : undefined
  });

  const anchorScore = totalAnchors > 0
    ? Math.round((1 - missingFiles.length / totalAnchors) * 100)
    : 100;
  const sectionScore = indexExists
    ? Math.round((1 - missingSections.length / requiredIndexSections.length) * 100)
    : 0;
  const linkScore = indexExists
    ? (brokenLinks.length > 0 ? Math.max(0, 100 - brokenLinks.length * 20) : 100)
    : 0;
  const duplicateScore = Math.max(0, 100 - duplicateFiles.length * 25);
  const agingScore = knowledgeDocumentCount > 0
    ? Math.round((1 - staleFiles.length / knowledgeDocumentCount) * 100)
    : 100;
  const placeholderScore = knowledgeDocumentCount > 3
    ? Math.max(0, 100 - Math.max(0, placeholderCount - 3) * 10)
    : 100;

  const dimensions: KnowledgeHealthScoreDimension[] = [
    {
      id: 'anchors',
      label: '结构锚点完整度',
      weight: 20,
      score: anchorScore,
      status: dimensionStatus(anchorScore),
      detail: missingFiles.length > 0 ? `缺失 ${missingFiles.length} 个锚点` : undefined
    },
    {
      id: 'index-sections',
      label: 'INDEX 区块完整度',
      weight: 20,
      score: sectionScore,
      status: dimensionStatus(sectionScore),
      detail: indexExists
        ? (missingSections.length > 0 ? `缺失 ${missingSections.length} 个区块` : undefined)
        : 'INDEX.md 缺失'
    },
    {
      id: 'broken-links',
      label: 'INDEX 断链',
      weight: 20,
      score: linkScore,
      status: dimensionStatus(linkScore),
      detail: indexExists
        ? (brokenLinks.length > 0 ? `${brokenLinks.length} 处断链` : undefined)
        : 'INDEX.md 缺失'
    },
    {
      id: 'duplicates',
      label: '重复知识文件',
      weight: 15,
      score: duplicateScore,
      status: dimensionStatus(duplicateScore),
      detail: duplicateFiles.length > 0 ? `${duplicateFiles.length} 个重复文件` : undefined
    },
    {
      id: 'aging',
      label: '知识老化',
      weight: 10,
      score: agingScore,
      status: dimensionStatus(agingScore),
      detail: staleFiles.length > 0 ? `${staleFiles.length} 个文件超过 ${staleDays} 天` : undefined
    },
    {
      id: 'placeholders',
      label: '占位密度',
      weight: 15,
      score: placeholderScore,
      status: dimensionStatus(placeholderScore),
      detail: placeholderCount > 0 ? `占位 ${placeholderCount} 处` : undefined
    }
  ];

  return {
    status: overallStatus(checks),
    rootPath,
    checks,
    summary: summarize(checks),
    generatedAt,
    score: computeScore(dimensions)
  };
}
