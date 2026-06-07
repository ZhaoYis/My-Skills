import fs from 'fs-extra';
import path from 'node:path';
import type { ManagedAssetRecord } from '../manifest/types.js';
import type { HealthCheckResult, HealthStatus, KnowledgeHealthReport } from './types.js';

const knowledgeRoot = '.knowledge';
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

async function countKnowledgeDocuments(rootPath: string): Promise<number> {
  if (!(await fs.pathExists(rootPath))) {
    return 0;
  }

  const entries = await fs.readdir(rootPath, { recursive: true });
  return entries.filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => entry.endsWith('.md'))
    .filter((entry) => path.basename(entry) !== 'README.md')
    .length;
}

export async function checkKnowledgeHealth(
  targetDir: string,
  managedAssets: ManagedAssetRecord[] = []
): Promise<KnowledgeHealthReport> {
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
      summary: summarize(checks)
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

  checks.push({
    id: 'knowledge-required-anchors',
    status: missingFiles.length > 0 ? 'warn' : 'ok',
    message: missingFiles.length > 0
      ? 'Some expected .knowledge anchor files or directories are missing.'
      : 'Expected .knowledge anchor files and directories are present.',
    path: rootPath,
    missingFiles: missingFiles.length > 0 ? missingFiles : undefined
  });

  const indexPath = path.join(rootPath, 'INDEX.md');
  if (await fs.pathExists(indexPath)) {
    const content = await fs.readFile(indexPath, 'utf8');
    const missingSections = requiredIndexSections.filter((section) => !content.includes(section));
    const placeholderCount = (content.match(/待补充/g) ?? []).length;
    const knowledgeDocumentCount = await countKnowledgeDocuments(rootPath);

    checks.push({
      id: 'knowledge-index-sections',
      status: missingSections.length > 0 ? 'warn' : 'ok',
      message: missingSections.length > 0
        ? 'INDEX.md is missing expected sections.'
        : 'INDEX.md contains the expected section anchors.',
      path: indexPath,
      missingSections: missingSections.length > 0 ? missingSections : undefined
    });

    checks.push({
      id: 'knowledge-index-placeholders',
      status: placeholderCount >= 4 && knowledgeDocumentCount > 3 ? 'warn' : 'ok',
      message: placeholderCount >= 4 && knowledgeDocumentCount > 3
        ? 'INDEX.md still contains many placeholder rows and may need maintenance.'
        : 'INDEX.md placeholder usage looks reasonable for the current knowledge set.',
      path: indexPath,
      placeholderCount
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

  return {
    status: overallStatus(checks),
    rootPath,
    checks,
    summary: summarize(checks)
  };
}
