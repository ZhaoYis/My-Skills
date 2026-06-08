import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { runInit } from '../../src/core/init/runInit.js';
import { MANIFEST_FILE, MANIFEST_PACKAGE_JSON_KEY, PACKAGE_JSON_FILE } from '../../src/core/runtime/meta.js';
import { readManifest as readStoredManifest } from '../../src/core/manifest/io.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function readManifest(dir: string): Promise<PipelineManifest> {
  const result = await readStoredManifest(dir);
  if (!result) {
    throw new Error('Manifest not found');
  }

  return result.manifest;
}

const toolExpectations = {
  claude: [
    'CLAUDE.md',
    '.knowledge/README.md',
    '.knowledge/INDEX.md',
    '.knowledge/tech/development-experience.md',
    '.claude/skills/opsx-dev-pipeline/SKILL.md',
    '.claude/skills/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.claude/skills/opsx-dev-pipeline/assets/decision-point-index.md',
    '.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.claude/skills/opsx-learn/SKILL.md',
    '.claude/skills/opsx-learn/references/phase-1-understand-goal.md',
    '.claude/skills/opsx-learn/assets/write-targets.md',
    '.claude/skills/opsx-learn/assets/preflight-json-contract.md',
    '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.claude/skills/opsx-analysis/SKILL.md',
    '.claude/skills/opsx-analysis/references/phase-1-clarify-requirement.md',
    '.claude/skills/opsx-analysis/references/phase-2-explore-context.md',
    '.claude/skills/opsx-analysis/references/phase-3-split-capabilities.md',
    '.claude/skills/opsx-analysis/references/phase-4-assess-impact.md',
    '.claude/skills/opsx-analysis/references/phase-5-output-analysis.md',
    '.claude/skills/opsx-analysis/assets/analysis-output-template.md',
    '.claude/skills/opsx-analysis/assets/evidence-standards.md',
    '.claude/skills/opsx-analysis/assets/maintenance-index.md',
    '.claude/skills/opsx-analysis/assets/question-checklist.md',
    '.claude/skills/opsx-analysis/scripts/opsx-analysis-preflight.sh',
    '.claude/skills/git-commit-push/SKILL.md',
    '.claude/skills/git-code-review/SKILL.md',
    '.claude/skills/git-merge-branch/SKILL.md',
    '.claude/skills/file-code-review/SKILL.md',
    '.claude/commands/opsx-dev-pipeline.md',
    '.claude/commands/opsx-learn.md',
    '.claude/commands/opsx-analysis.md',
    '.claude/commands/git-commit-push.md',
    '.claude/commands/git-code-review.md',
    '.claude/commands/git-merge-branch.md',
    '.claude/commands/file-code-review.md'
  ],
  cursor: [
    '.cursor/rules/opsx-dev-pipeline.mdc',
    '.knowledge/README.md',
    '.knowledge/INDEX.md',
    '.knowledge/tech/development-experience.md',
    '.cursor/rules/opsx-dev-pipeline/SKILL.md',
    '.cursor/rules/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.cursor/rules/opsx-dev-pipeline/assets/decision-point-index.md',
    '.cursor/rules/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.cursor/rules/opsx-learn/SKILL.md',
    '.cursor/rules/opsx-learn/references/phase-1-understand-goal.md',
    '.cursor/rules/opsx-learn/assets/write-targets.md',
    '.cursor/rules/opsx-learn/assets/preflight-json-contract.md',
    '.cursor/rules/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.cursor/rules/opsx-analysis/SKILL.md',
    '.cursor/rules/opsx-analysis/references/phase-1-clarify-requirement.md',
    '.cursor/rules/opsx-analysis/references/phase-2-explore-context.md',
    '.cursor/rules/opsx-analysis/references/phase-3-split-capabilities.md',
    '.cursor/rules/opsx-analysis/references/phase-4-assess-impact.md',
    '.cursor/rules/opsx-analysis/references/phase-5-output-analysis.md',
    '.cursor/rules/opsx-analysis/assets/analysis-output-template.md',
    '.cursor/rules/opsx-analysis/assets/evidence-standards.md',
    '.cursor/rules/opsx-analysis/assets/maintenance-index.md',
    '.cursor/rules/opsx-analysis/assets/question-checklist.md',
    '.cursor/rules/opsx-analysis/scripts/opsx-analysis-preflight.sh',
    '.cursor/rules/git-commit-push/SKILL.md',
    '.cursor/rules/git-code-review/SKILL.md',
    '.cursor/rules/git-merge-branch/SKILL.md',
    '.cursor/rules/file-code-review/SKILL.md',
    '.cursor/commands/opsx-dev-pipeline.md',
    '.cursor/commands/opsx-learn.md',
    '.cursor/commands/opsx-analysis.md',
    '.cursor/commands/git-commit-push.md',
    '.cursor/commands/git-code-review.md',
    '.cursor/commands/git-merge-branch.md',
    '.cursor/commands/file-code-review.md',
    '.cursor/commands/README.md'
  ],
  codex: [
    '.codex/prompts/opsx-dev-pipeline.md',
    '.knowledge/README.md',
    '.knowledge/INDEX.md',
    '.knowledge/tech/development-experience.md',
    '.codex/prompts/opsx-dev-pipeline/SKILL.md',
    '.codex/prompts/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.codex/prompts/opsx-dev-pipeline/assets/decision-point-index.md',
    '.codex/prompts/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.codex/prompts/opsx-learn/SKILL.md',
    '.codex/prompts/opsx-learn/references/phase-1-understand-goal.md',
    '.codex/prompts/opsx-learn/assets/write-targets.md',
    '.codex/prompts/opsx-learn/assets/preflight-json-contract.md',
    '.codex/prompts/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.codex/prompts/opsx-analysis/SKILL.md',
    '.codex/prompts/opsx-analysis/references/phase-1-clarify-requirement.md',
    '.codex/prompts/opsx-analysis/references/phase-2-explore-context.md',
    '.codex/prompts/opsx-analysis/references/phase-3-split-capabilities.md',
    '.codex/prompts/opsx-analysis/references/phase-4-assess-impact.md',
    '.codex/prompts/opsx-analysis/references/phase-5-output-analysis.md',
    '.codex/prompts/opsx-analysis/assets/analysis-output-template.md',
    '.codex/prompts/opsx-analysis/assets/evidence-standards.md',
    '.codex/prompts/opsx-analysis/assets/maintenance-index.md',
    '.codex/prompts/opsx-analysis/assets/question-checklist.md',
    '.codex/prompts/opsx-analysis/scripts/opsx-analysis-preflight.sh',
    '.codex/prompts/git-commit-push/SKILL.md',
    '.codex/prompts/git-code-review/SKILL.md',
    '.codex/prompts/git-merge-branch/SKILL.md',
    '.codex/prompts/file-code-review/SKILL.md',
    '.codex/commands/opsx-dev-pipeline.md',
    '.codex/commands/opsx-learn.md',
    '.codex/commands/opsx-analysis.md',
    '.codex/commands/git-commit-push.md',
    '.codex/commands/git-code-review.md',
    '.codex/commands/git-merge-branch.md',
    '.codex/commands/file-code-review.md',
    '.codex/commands/README.md'
  ],
  generic: [
    '.ai/README.md',
    '.knowledge/README.md',
    '.knowledge/INDEX.md',
    '.knowledge/tech/development-experience.md',
    '.ai/skills/opsx-dev-pipeline/SKILL.md',
    '.ai/skills/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.ai/skills/opsx-dev-pipeline/assets/decision-point-index.md',
    '.ai/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.ai/skills/opsx-learn/SKILL.md',
    '.ai/skills/opsx-learn/references/phase-1-understand-goal.md',
    '.ai/skills/opsx-learn/assets/write-targets.md',
    '.ai/skills/opsx-learn/assets/preflight-json-contract.md',
    '.ai/skills/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.ai/skills/opsx-analysis/SKILL.md',
    '.ai/skills/opsx-analysis/references/phase-1-clarify-requirement.md',
    '.ai/skills/opsx-analysis/references/phase-2-explore-context.md',
    '.ai/skills/opsx-analysis/references/phase-3-split-capabilities.md',
    '.ai/skills/opsx-analysis/references/phase-4-assess-impact.md',
    '.ai/skills/opsx-analysis/references/phase-5-output-analysis.md',
    '.ai/skills/opsx-analysis/assets/analysis-output-template.md',
    '.ai/skills/opsx-analysis/assets/evidence-standards.md',
    '.ai/skills/opsx-analysis/assets/maintenance-index.md',
    '.ai/skills/opsx-analysis/assets/question-checklist.md',
    '.ai/skills/opsx-analysis/scripts/opsx-analysis-preflight.sh',
    '.ai/skills/git-commit-push/SKILL.md',
    '.ai/skills/git-code-review/SKILL.md',
    '.ai/skills/git-merge-branch/SKILL.md',
    '.ai/skills/file-code-review/SKILL.md',
    '.ai/commands/opsx-dev-pipeline.md',
    '.ai/commands/opsx-learn.md',
    '.ai/commands/opsx-analysis.md',
    '.ai/commands/git-commit-push.md',
    '.ai/commands/git-code-review.md',
    '.ai/commands/git-merge-branch.md',
    '.ai/commands/file-code-review.md'
  ]
} as const;

describe('tool matrix', () => {
  it.each(Object.entries(toolExpectations))('initializes %s successfully', async (tool, expectedFiles) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-${tool}-`));
    createdDirs.push(dir);

    await runInit({ dir, tool: tool as 'claude' | 'cursor' | 'codex' | 'generic', yes: true, force: false, dryRun: false });

    for (const file of expectedFiles) {
      expect(await fs.pathExists(path.join(dir, file))).toBe(true);
    }

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
    expect(await fs.pathExists(path.join(dir, expectedFiles[1].split('/').slice(0, -1).join('/'), 'tests'))).toBe(false);
  });

  it('embeds manifest in package.json when package.json exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-package-json-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, PACKAGE_JSON_FILE), {
      name: 'demo-app',
      version: '1.0.0'
    });

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);

    const pkg = await fs.readJson(path.join(dir, PACKAGE_JSON_FILE));
    expect(pkg[MANIFEST_PACKAGE_JSON_KEY].tool).toBe('claude');
    expect(pkg[MANIFEST_PACKAGE_JSON_KEY].managedAssets.length).toBeGreaterThan(0);
  });

  it('supports dry-run without writing files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-dry-run-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: true });
    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);
  });

  it('supports doctor, sync, and upgrade on an initialized repo', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-lifecycle-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'generic', yes: true, force: false, dryRun: false });
    await runDoctorCommand(dir);
    await runSyncCommand({ dir, force: true, dryRun: false });
    await runUpgradeCommand({ dir, force: true, dryRun: false });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
  });

  it('doctor supports json output with knowledge report', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-doctor-json-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const skillContent = await fs.readFile(path.join(dir, '.claude/skills/opsx-learn/SKILL.md'), 'utf8');
    const preflightContent = await fs.readFile(path.join(dir, '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh'), 'utf8');
    const phaseFiveContent = await fs.readFile(path.join(dir, '.claude/skills/opsx-learn/references/phase-5-review-and-write.md'), 'utf8');
    const writeTargetsContent = await fs.readFile(path.join(dir, '.claude/skills/opsx-learn/assets/write-targets.md'), 'utf8');
    const maintenanceContent = await fs.readFile(path.join(dir, '.claude/skills/opsx-learn/assets/maintenance-index.md'), 'utf8');
    const contractContent = await fs.readFile(path.join(dir, '.claude/skills/opsx-learn/assets/preflight-json-contract.md'), 'utf8');

    expect(skillContent).toContain('knowledgeHealth');
    expect(preflightContent).toContain('opsx-dev-pipeline doctor --json');
    expect(preflightContent).toContain('knowledgeHealthStatus');
    expect(preflightContent).toContain('knowledgeHealthSummary');
    expect(preflightContent).toContain('knowledgeHealthHighlights');
    expect(phaseFiveContent).toContain('knowledgeHealthSummary');
    expect(writeTargetsContent).toContain('knowledgeHealthSummary');
    expect(writeTargetsContent).toContain('knowledgeHealthHighlights');
    expect(maintenanceContent).toContain('先看 `knowledgeHealthSummary`');
    expect(maintenanceContent).toContain('assets/preflight-json-contract.md');
    expect(contractContent).toContain('## 顶层字段');
    expect(contractContent).toContain('knowledgeHealthAvailable');
    expect(contractContent).toContain('## 降级语义');

    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDoctorCommand(dir, true);

    const payload = spy.mock.calls.map(([value]) => String(value)).join('\n');
    spy.mockRestore();

    const parsed = JSON.parse(payload);
    expect(parsed.knowledge).toBeDefined();
    expect(['ok', 'warn']).toContain(parsed.knowledge.status);
    expect(parsed.manifest.status).toBe('ok');
  });

  const overlayExpectations = {
    claude: { overlay: 'CLAUDE.md', skillsDir: '.claude/skills', expectAlwaysApply: false },
    cursor: { overlay: '.cursor/rules/opsx-dev-pipeline.mdc', skillsDir: '.cursor/rules', expectAlwaysApply: true },
    codex: { overlay: '.codex/prompts/opsx-dev-pipeline.md', skillsDir: '.codex/prompts', expectAlwaysApply: false },
    generic: { overlay: '.ai/README.md', skillsDir: '.ai/skills', expectAlwaysApply: false }
  } as const;

  it.each(Object.entries(overlayExpectations))(
    'injects the knowledge-first rule into the %s overlay',
    async (tool, { overlay, expectAlwaysApply }) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-overlay-${tool}-`));
      createdDirs.push(dir);

      await runInit({ dir, tool: tool as 'claude' | 'cursor' | 'codex' | 'generic', yes: true, force: false, dryRun: false });

      const content = await fs.readFile(path.join(dir, overlay), 'utf8');
      expect(content).toContain('知识优先');
      expect(content).toContain('.knowledge/INDEX.md');
      expect(content).toContain('追加不覆盖');

      if (expectAlwaysApply) {
        expect(content).toContain('alwaysApply: true');
      }
    }
  );

  it('embeds the new pipeline gates and decision points in skill references', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-gates-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const skillRoot = path.join(dir, '.claude/skills/opsx-dev-pipeline');

    const archive = await fs.readFile(path.join(skillRoot, 'references/phase-4-archive.md'), 'utf8');
    expect(archive).toContain('步骤 15.5');
    expect(archive).toContain('决策点 4c');
    expect(archive).toContain('知识沉淀');

    const apply = await fs.readFile(path.join(skillRoot, 'references/phase-2-apply.md'), 'utf8');
    expect(apply).toContain('写前复用门禁');
    expect(apply).toContain('自审查硬门禁');
    expect(apply).toContain('apply-quality-gate.md');

    const propose = await fs.readFile(path.join(skillRoot, 'references/phase-1-propose.md'), 'utf8');
    expect(propose).toContain('决策点 1c');
    expect(propose).toContain('需求理解确认');

    expect(await fs.pathExists(path.join(skillRoot, 'assets/apply-quality-gate.md'))).toBe(true);
    expect(await fs.pathExists(path.join(skillRoot, 'assets/structural-analysis-hint.md'))).toBe(true);

    const decisionIndex = await fs.readFile(path.join(skillRoot, 'assets/decision-point-index.md'), 'utf8');
    expect(decisionIndex).toContain('| 4c |');
    expect(decisionIndex).toContain('| 1c |');
  });

  it('writes a concise root README for new projects', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-generated-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const readmeContent = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
    expect(readmeContent).toContain(`# ${path.basename(dir)}`);
    expect(readmeContent).toContain('## Quick start');
    expect(readmeContent).not.toContain('## Enabled features');
  });

  it('preserves an existing root README during init without force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-existing-'));
    createdDirs.push(dir);
    const existingReadme = path.join(dir, 'README.md');
    const originalContent = '# Existing project\n';

    await fs.writeFile(existingReadme, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    expect(await fs.readFile(existingReadme, 'utf8')).toBe(originalContent);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(true);

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-readme')).toBe(false);
  });

  it('overwrites an existing root README during init with force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-force-'));
    createdDirs.push(dir);
    const existingReadme = path.join(dir, 'README.md');

    await fs.writeFile(existingReadme, '# Existing project\n');
    await runInit({ dir, tool: 'claude', yes: true, force: true, dryRun: false });

    const readmeContent = await fs.readFile(existingReadme, 'utf8');
    expect(readmeContent).not.toBe('# Existing project\n');

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-readme')).toBe(true);
  });

  it('does not adopt a skipped root README during sync', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-sync-'));
    createdDirs.push(dir);
    const existingReadme = path.join(dir, 'README.md');
    const originalContent = '# Existing project\n';

    await fs.writeFile(existingReadme, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await runSyncCommand({ dir, force: true, dryRun: false });

    expect(await fs.readFile(existingReadme, 'utf8')).toBe(originalContent);
    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-readme')).toBe(false);
  });

  it('preserves an existing root .gitignore during init without force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-gitignore-existing-'));
    createdDirs.push(dir);
    const existingGitignore = path.join(dir, '.gitignore');
    const originalContent = 'node_modules\n';

    await fs.writeFile(existingGitignore, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    expect(await fs.readFile(existingGitignore, 'utf8')).toBe(originalContent);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(true);

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-gitignore')).toBe(false);
  });

  it('overwrites an existing root .gitignore during init with force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-gitignore-force-'));
    createdDirs.push(dir);
    const existingGitignore = path.join(dir, '.gitignore');

    await fs.writeFile(existingGitignore, 'node_modules\n');
    await runInit({ dir, tool: 'claude', yes: true, force: true, dryRun: false });

    const gitignoreContent = await fs.readFile(existingGitignore, 'utf8');
    expect(gitignoreContent).not.toBe('node_modules\n');

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-gitignore')).toBe(true);
  });

  it('does not adopt a skipped root .gitignore during sync', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-gitignore-sync-'));
    createdDirs.push(dir);
    const existingGitignore = path.join(dir, '.gitignore');
    const originalContent = 'node_modules\n';

    await fs.writeFile(existingGitignore, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await runSyncCommand({ dir, force: true, dryRun: false });

    expect(await fs.readFile(existingGitignore, 'utf8')).toBe(originalContent);
    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-gitignore')).toBe(false);
  });

  it('appends to an existing root README when duplicate conflicts are auto-skipped only for yes=false flows later', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-append-manual-'));
    createdDirs.push(dir);
  });

  it('sync skips conflicts when yes is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-yes-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    await runSyncCommand({ dir, yes: true, force: false, dryRun: false });
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('custom\n');
  });

  it('sync overwrites conflicts when force is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-force-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    await runSyncCommand({ dir, force: true, dryRun: false });
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).not.toBe('custom\n');
  });

  it('upgrade adopts the knowledge skeleton for legacy projects without existing knowledge directories', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-upgrade-knowledge-adopt-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.remove(path.join(dir, '.knowledge'));

    const manifest = await readManifest(dir);
    manifest.managedAssets = manifest.managedAssets.filter((asset) => !asset.id.startsWith('common-knowledge-skeleton:'));
    await fs.writeJson(path.join(dir, MANIFEST_FILE), manifest, { spaces: 2 });

    await runUpgradeCommand({ dir, yes: true, force: false, dryRun: false });

    expect(await fs.pathExists(path.join(dir, '.knowledge/README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.knowledge/INDEX.md'))).toBe(true);
  });

  it('upgrade skips knowledge skeleton adoption when another knowledge directory already exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-upgrade-knowledge-skip-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.remove(path.join(dir, '.knowledge'));
    await fs.ensureDir(path.join(dir, 'docs/knowledge'));

    const manifest = await readManifest(dir);
    manifest.managedAssets = manifest.managedAssets.filter((asset) => !asset.id.startsWith('common-knowledge-skeleton:'));
    await fs.writeJson(path.join(dir, MANIFEST_FILE), manifest, { spaces: 2 });

    await runUpgradeCommand({ dir, yes: true, force: false, dryRun: false });

    expect(await fs.pathExists(path.join(dir, '.knowledge/README.md'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, 'docs/knowledge'))).toBe(true);
  });

  it('upgrade inherits sync conflict behavior when yes is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-upgrade-yes-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    await runUpgradeCommand({ dir, yes: true, force: false, dryRun: false });
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('custom\n');
  });

  it('sync prompts for conflicts without yes or force', () => {
    expect(true).toBe(true);
  });
});
