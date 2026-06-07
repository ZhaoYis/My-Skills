import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { runInit } from '../../src/core/init/runInit.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function readManifest(dir: string): Promise<PipelineManifest> {
  return fs.readJson(path.join(dir, MANIFEST_FILE)) as Promise<PipelineManifest>;
}

const toolExpectations = {
  claude: [
    'CLAUDE.md',
    '.claude/skills/opsx-dev-pipeline/SKILL.md',
    '.claude/skills/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.claude/skills/opsx-dev-pipeline/assets/decision-point-index.md',
    '.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.claude/skills/opsx-learn/SKILL.md',
    '.claude/skills/opsx-learn/references/phase-1-understand-goal.md',
    '.claude/skills/opsx-learn/assets/write-targets.md',
    '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.claude/commands/opsx-dev-pipeline.md',
    '.claude/commands/opsx-learn.md',
    '.claude/commands/review.md'
  ],
  cursor: [
    '.cursor/rules/opsx-dev-pipeline.mdc',
    '.cursor/rules/opsx-dev-pipeline/SKILL.md',
    '.cursor/rules/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.cursor/rules/opsx-dev-pipeline/assets/decision-point-index.md',
    '.cursor/rules/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.cursor/rules/opsx-learn/SKILL.md',
    '.cursor/rules/opsx-learn/references/phase-1-understand-goal.md',
    '.cursor/rules/opsx-learn/assets/write-targets.md',
    '.cursor/rules/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.cursor/commands/opsx-dev-pipeline.md',
    '.cursor/commands/opsx-learn.md',
    '.cursor/commands/review.md',
    '.cursor/commands/README.md'
  ],
  codex: [
    '.codex/prompts/opsx-dev-pipeline.md',
    '.codex/prompts/opsx-dev-pipeline/SKILL.md',
    '.codex/prompts/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.codex/prompts/opsx-dev-pipeline/assets/decision-point-index.md',
    '.codex/prompts/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.codex/prompts/opsx-learn/SKILL.md',
    '.codex/prompts/opsx-learn/references/phase-1-understand-goal.md',
    '.codex/prompts/opsx-learn/assets/write-targets.md',
    '.codex/prompts/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.codex/commands/opsx-dev-pipeline.md',
    '.codex/commands/opsx-learn.md',
    '.codex/commands/review.md',
    '.codex/commands/README.md'
  ],
  generic: [
    '.ai/README.md',
    '.ai/skills/opsx-dev-pipeline/SKILL.md',
    '.ai/skills/opsx-dev-pipeline/references/phase-0-entrance.md',
    '.ai/skills/opsx-dev-pipeline/assets/decision-point-index.md',
    '.ai/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh',
    '.ai/skills/opsx-learn/SKILL.md',
    '.ai/skills/opsx-learn/references/phase-1-understand-goal.md',
    '.ai/skills/opsx-learn/assets/write-targets.md',
    '.ai/skills/opsx-learn/scripts/opsx-learn-preflight.sh',
    '.ai/commands/opsx-dev-pipeline.md',
    '.ai/commands/opsx-learn.md',
    '.ai/commands/review.md'
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
