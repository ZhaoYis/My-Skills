import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkKnowledgeHealth } from '../../src/core/doctor/checkKnowledgeHealth.js';
import type { ManagedAssetRecord } from '../../src/core/manifest/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

const managedKnowledgeAssets: ManagedAssetRecord[] = [
  { id: 'common-knowledge-skeleton:README.md.hbs', destination: '.knowledge/README.md' },
  { id: 'common-knowledge-skeleton:INDEX.md', destination: '.knowledge/INDEX.md' }
];

describe('checkKnowledgeHealth', () => {
  it('warns when managed knowledge directory is missing', async () => {
    const dir = await createTempDir('opsx-knowledge-missing-');
    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);

    expect(report.status).toBe('warn');
    expect(report.checks[0]?.id).toBe('knowledge-directory-exists');
    expect(report.checks[0]?.status).toBe('warn');
  });

  it('reports ok for a complete starter knowledge skeleton', async () => {
    const dir = await createTempDir('opsx-knowledge-complete-');
    await fs.ensureDir(path.join(dir, '.knowledge/project'));
    await fs.ensureDir(path.join(dir, '.knowledge/business'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/api'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/db'));
    await fs.ensureDir(path.join(dir, '.knowledge/config'));
    await fs.ensureDir(path.join(dir, '.knowledge/ops'));
    await fs.ensureDir(path.join(dir, '.knowledge/risks'));
    await fs.writeFile(path.join(dir, '.knowledge/README.md'), '# Knowledge\n');
    await fs.writeFile(path.join(dir, '.knowledge/project/README.md'), '# Project\n');
    await fs.writeFile(path.join(dir, '.knowledge/business/README.md'), '# Business\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/README.md'), '# Tech\n');
    await fs.writeFile(path.join(dir, '.knowledge/ops/README.md'), '# Ops\n');
    await fs.writeFile(path.join(dir, '.knowledge/risks/README.md'), '# Risks\n');
    await fs.writeFile(
      path.join(dir, '.knowledge/INDEX.md'),
      [
        '# 知识库索引',
        '## API 路径索引',
        '## 功能域索引',
        '## 数据模型 / 表索引',
        '## 外部服务索引',
        '## 风险 / 故障索引',
        '## 运维知识索引',
        '## 开发规范 / 工作流'
      ].join('\n')
    );

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    expect(report.status).toBe('ok');
    expect(report.summary.warn).toBe(0);
  });

  it('warns when index sections are missing', async () => {
    const dir = await createTempDir('opsx-knowledge-index-missing-');
    await fs.ensureDir(path.join(dir, '.knowledge/project'));
    await fs.ensureDir(path.join(dir, '.knowledge/business'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/api'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/db'));
    await fs.ensureDir(path.join(dir, '.knowledge/config'));
    await fs.ensureDir(path.join(dir, '.knowledge/ops'));
    await fs.ensureDir(path.join(dir, '.knowledge/risks'));
    await fs.writeFile(path.join(dir, '.knowledge/README.md'), '# Knowledge\n');
    await fs.writeFile(path.join(dir, '.knowledge/project/README.md'), '# Project\n');
    await fs.writeFile(path.join(dir, '.knowledge/business/README.md'), '# Business\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/README.md'), '# Tech\n');
    await fs.writeFile(path.join(dir, '.knowledge/ops/README.md'), '# Ops\n');
    await fs.writeFile(path.join(dir, '.knowledge/risks/README.md'), '# Risks\n');
    await fs.writeFile(path.join(dir, '.knowledge/INDEX.md'), '# 知识库索引\n## API 路径索引\n');

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    const sectionCheck = report.checks.find((check) => check.id === 'knowledge-index-sections');
    expect(sectionCheck?.status).toBe('warn');
    expect(sectionCheck?.missingSections?.length).toBeGreaterThan(0);
  });

  it('warns when placeholder-heavy index suggests drift', async () => {
    const dir = await createTempDir('opsx-knowledge-placeholder-');
    await fs.ensureDir(path.join(dir, '.knowledge/project'));
    await fs.ensureDir(path.join(dir, '.knowledge/business'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/api'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/db'));
    await fs.ensureDir(path.join(dir, '.knowledge/config'));
    await fs.ensureDir(path.join(dir, '.knowledge/ops'));
    await fs.ensureDir(path.join(dir, '.knowledge/risks'));
    await fs.writeFile(path.join(dir, '.knowledge/README.md'), '# Knowledge\n');
    await fs.writeFile(path.join(dir, '.knowledge/project/README.md'), '# Project\n');
    await fs.writeFile(path.join(dir, '.knowledge/business/README.md'), '# Business\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/README.md'), '# Tech\n');
    await fs.writeFile(path.join(dir, '.knowledge/ops/README.md'), '# Ops\n');
    await fs.writeFile(path.join(dir, '.knowledge/risks/README.md'), '# Risks\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/development-experience.md'), '# Dev\n');
    await fs.writeFile(path.join(dir, '.knowledge/risks/known-issues.md'), '# Issues\n');
    await fs.writeFile(path.join(dir, '.knowledge/ops/deployment-checklist-template.md'), '# Deploy\n');
    await fs.writeFile(
      path.join(dir, '.knowledge/INDEX.md'),
      [
        '# 知识库索引',
        '## API 路径索引',
        '| 待补充 | 待补充 |',
        '## 功能域索引',
        '| 待补充 | 待补充 | 待补充 |',
        '## 数据模型 / 表索引',
        '| 待补充 | 待补充 |',
        '## 外部服务索引',
        '| 待补充 | 待补充 | 待补充 |',
        '## 风险 / 故障索引',
        '| 待补充 | 待补充 |',
        '## 运维知识索引',
        '| 待补充 | 待补充 |',
        '## 开发规范 / 工作流'
      ].join('\n')
    );

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    const placeholderCheck = report.checks.find((check) => check.id === 'knowledge-index-placeholders');
    expect(placeholderCheck?.status).toBe('warn');
    expect(placeholderCheck?.placeholderCount).toBeGreaterThanOrEqual(4);
  });

  async function writeCompleteSkeleton(dir: string, indexExtra = ''): Promise<void> {
    await fs.ensureDir(path.join(dir, '.knowledge/project'));
    await fs.ensureDir(path.join(dir, '.knowledge/business'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/api'));
    await fs.ensureDir(path.join(dir, '.knowledge/tech/db'));
    await fs.ensureDir(path.join(dir, '.knowledge/config'));
    await fs.ensureDir(path.join(dir, '.knowledge/ops'));
    await fs.ensureDir(path.join(dir, '.knowledge/risks'));
    await fs.writeFile(path.join(dir, '.knowledge/README.md'), '# Knowledge\n');
    await fs.writeFile(path.join(dir, '.knowledge/project/README.md'), '# Project\n');
    await fs.writeFile(path.join(dir, '.knowledge/business/README.md'), '# Business\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/README.md'), '# Tech\n');
    await fs.writeFile(path.join(dir, '.knowledge/ops/README.md'), '# Ops\n');
    await fs.writeFile(path.join(dir, '.knowledge/risks/README.md'), '# Risks\n');
    await fs.writeFile(
      path.join(dir, '.knowledge/INDEX.md'),
      [
        '# 知识库索引',
        '## API 路径索引',
        '## 功能域索引',
        '## 数据模型 / 表索引',
        '## 外部服务索引',
        '## 风险 / 故障索引',
        '## 运维知识索引',
        '## 开发规范 / 工作流',
        indexExtra
      ].join('\n')
    );
  }

  it('produces a health score and grade for a complete skeleton', async () => {
    const dir = await createTempDir('opsx-knowledge-score-');
    await writeCompleteSkeleton(dir);

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    expect(report.score).toBeDefined();
    expect(report.score?.value).toBeGreaterThanOrEqual(80);
    expect(report.score?.grade).toBe('healthy');
    expect(report.score?.dimensions.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it('detects broken links referenced from INDEX.md', async () => {
    const dir = await createTempDir('opsx-knowledge-brokenlinks-');
    await writeCompleteSkeleton(dir, '\n- [缺失文档](tech/api/missing.md)\n- `tech/db/also-missing.md`\n');

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    const brokenCheck = report.checks.find((check) => check.id === 'knowledge-index-broken-links');
    expect(brokenCheck?.status).toBe('warn');
    expect(brokenCheck?.brokenLinks).toContain('tech/api/missing.md');
    expect(brokenCheck?.brokenLinks).toContain('tech/db/also-missing.md');
  });

  it('does not flag links that resolve to existing files', async () => {
    const dir = await createTempDir('opsx-knowledge-validlinks-');
    await writeCompleteSkeleton(dir, '\n- [存在](tech/api/present.md)\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/api/present.md'), '# Present\n');

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    const brokenCheck = report.checks.find((check) => check.id === 'knowledge-index-broken-links');
    expect(brokenCheck?.status).toBe('ok');
  });

  it('detects duplicate knowledge file names across directories', async () => {
    const dir = await createTempDir('opsx-knowledge-duplicates-');
    await writeCompleteSkeleton(dir);
    await fs.writeFile(path.join(dir, '.knowledge/business/payment.md'), '# Payment business\n');
    await fs.writeFile(path.join(dir, '.knowledge/tech/api/payment.md'), '# Payment api\n');

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets);
    const dupCheck = report.checks.find((check) => check.id === 'knowledge-duplicate-files');
    expect(dupCheck?.status).toBe('warn');
    expect(dupCheck?.duplicateFiles).toContain('business/payment.md');
    expect(dupCheck?.duplicateFiles).toContain('tech/api/payment.md');
  });

  it('flags stale knowledge files based on staleDays threshold', async () => {
    const dir = await createTempDir('opsx-knowledge-aging-');
    await writeCompleteSkeleton(dir);
    const stalePath = path.join(dir, '.knowledge/tech/old-note.md');
    await fs.writeFile(stalePath, '# Old note\n');
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    await fs.utimes(stalePath, old, old);

    const report = await checkKnowledgeHealth(dir, managedKnowledgeAssets, { staleDays: 90 });
    const agingCheck = report.checks.find((check) => check.id === 'knowledge-aging');
    expect(agingCheck?.status).toBe('warn');
    expect(agingCheck?.staleFiles).toContain('tech/old-note.md');
  });

  it('detects alternate knowledge directories such as docs/knowledge', async () => {
    const dir = await createTempDir('opsx-knowledge-alt-');
    await fs.ensureDir(path.join(dir, 'docs/knowledge'));
    await fs.writeFile(path.join(dir, 'docs/knowledge/README.md'), '# Knowledge\n');

    const report = await checkKnowledgeHealth(dir);

    const locationCheck = report.checks.find((check) => check.id === 'knowledge-directory-exists');
    expect(locationCheck?.status).toBe('warn');
    expect(locationCheck?.message).toContain('docs/knowledge');
    expect(report.rootPath).toBe(path.join(dir, 'docs/knowledge'));
  });
});
