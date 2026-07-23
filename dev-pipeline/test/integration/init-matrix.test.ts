import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { runInit } from '../../src/core/init/runInit.js';
import {
  MANIFEST_FILE,
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_JSON_FILE,
} from '../../src/core/runtime/meta.js';
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

async function listAllFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      results.push(fullPath);
      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }
  await walk(root);
  return results;
}

const RETAINED_SKILL = 'opsx-dev-pipeline';
const RETAINED = [RETAINED_SKILL];
const removed = [
  'opsx-learn',
  'opsx-analysis',
  'opsx-design',
  'opsx-verify',
  'opsx-clarify',
  'opsx-health',
  'opsx-pr',
  'opsx-prototype',
  'opsx-ci-triage',
  'git-commit-push',
  'git-code-review',
  'git-merge-branch',
  'file-code-review',
];

const toolExpectations = {
  claude: [
    { path: 'CLAUDE.md', present: true },
    { path: '.knowledge/README.md', present: true },
    { path: '.knowledge/INDEX.md', present: true },
    { path: '.knowledge/tech/development-experience.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/assets/decision-point-index.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh', present: true },
    { path: '.claude/commands/opsx-dev-pipeline.md', present: true },
  ],
  cursor: [
    { path: '.cursor/rules/opsx-dev-pipeline.mdc', present: true },
    { path: '.knowledge/README.md', present: true },
    { path: '.knowledge/INDEX.md', present: true },
    { path: '.knowledge/tech/development-experience.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/assets/decision-point-index.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh', present: true },
    { path: '.cursor/commands/opsx-dev-pipeline.md', present: true },
    { path: '.cursor/commands/README.md', present: true },
  ],
  codex: [
    { path: '.codex/prompts/opsx-dev-pipeline.md', present: true },
    { path: '.knowledge/README.md', present: true },
    { path: '.knowledge/INDEX.md', present: true },
    { path: '.knowledge/tech/development-experience.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/assets/decision-point-index.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh', present: true },
    { path: '.codex/commands/opsx-dev-pipeline.md', present: true },
    { path: '.codex/commands/README.md', present: true },
  ],
  generic: [
    { path: '.ai/README.md', present: true },
    { path: '.knowledge/README.md', present: true },
    { path: '.knowledge/INDEX.md', present: true },
    { path: '.knowledge/tech/development-experience.md', present: true },
    { path: '.ai/skills/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.ai/skills/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.ai/skills/opsx-dev-pipeline/assets/decision-point-index.md', present: true },
    { path: '.ai/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh', present: true },
    { path: '.ai/commands/opsx-dev-pipeline.md', present: true },
  ],
} as const;

describe('tool matrix', () => {
  it.each(
    Object.entries(toolExpectations),
  )('initializes %s successfully', async (tool, expectations) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-${tool}-`));
    createdDirs.push(dir);

    await runInit({
      dir,
      tool: tool as 'claude' | 'cursor' | 'codex' | 'generic',
      yes: true,
      force: false,
      dryRun: false,
    });

    for (const { path: file, present } of expectations) {
      if (present) {
        expect(await fs.pathExists(path.join(dir, file))).toBe(true);
      } else {
        expect(await fs.pathExists(path.join(dir, file))).toBe(false);
      }
    }

    // Negative: no removed preset skills or commands in any adapter output
    const allFiles = await listAllFiles(dir);
    for (const name of removed) {
      expect(allFiles.filter((f) => f.includes(name))).toEqual([]);
    }

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
    // Negative: no tests directory with leaked legacy content
    expect(
      await fs.pathExists(
        path.join(dir, expectations[0].path.split('/').slice(0, -1).join('/'), 'tests'),
      ),
    ).toBe(false);
  });

  it('rejects removed optional features before installation', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-reject-removed-feature-'));
    createdDirs.push(dir);

    for (const removedFeature of ['prototype', 'opsx-pr', 'opsx-ci-triage']) {
      await expect(
        runInit({
          dir,
          tool: 'claude',
          yes: true,
          force: false,
          dryRun: true,
          feature: [removedFeature],
        }),
      ).rejects.toThrow(/Unknown feature/);
    }
  });

  it('generates structural-analysis-hint when the feature is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-structural-hint-enabled-'));
    createdDirs.push(dir);

    await runInit({
      dir,
      tool: 'claude',
      yes: true,
      force: false,
      dryRun: false,
      feature: ['structural-analysis-hint'],
    });

    const skillRoot = path.join(dir, '.claude/skills/opsx-dev-pipeline');
    expect(await fs.pathExists(path.join(skillRoot, 'assets/structural-analysis-hint.md'))).toBe(
      true,
    );

    const skillContent = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    expect(skillContent).toContain('structural-analysis-hint.md');

    const manifest = await readManifest(dir);
    expect(manifest.features).toContain('structural-analysis-hint');
  });

  it('structural-analysis-hint is the only optional feature', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-feature-optional-only-'));
    createdDirs.push(dir);

    // Default init should only have base features
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    const defaultManifest = await readManifest(dir);
    expect(
      defaultManifest.features.filter(
        (f) => f !== 'base' && f !== 'skills' && f !== 'commands' && f !== 'docs',
      ),
    ).toEqual([]);

    // structural-analysis-hint can be enabled
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-feature-sah-on-'));
    createdDirs.push(dir2);
    await runInit({
      dir: dir2,
      tool: 'claude',
      yes: true,
      force: false,
      dryRun: false,
      feature: ['structural-analysis-hint'],
    });
    const sahManifest = await readManifest(dir2);
    expect(sahManifest.features).toContain('structural-analysis-hint');
  });

  it('embeds manifest in package.json when package.json exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-package-json-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, PACKAGE_JSON_FILE), {
      name: 'demo-app',
      version: '1.0.0',
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

  it('doctor reports current manifest version after init', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-doctor-version-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      manifest: {
        versionCheck: { status: string };
      };
    };
    logSpy.mockRestore();

    expect(status).not.toBe('fail');
    expect(payload.manifest.versionCheck.status).toBe('current');
  });

  it('doctor emits JSON with knowledge and manifest status', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-doctor-json-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    // Verify retained assets exist
    expect(
      await fs.pathExists(
        path.join(dir, '.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-resolve-cli.sh'),
      ),
    ).toBe(true);

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
    cursor: {
      overlay: '.cursor/rules/opsx-dev-pipeline.mdc',
      skillsDir: '.cursor/rules',
      expectAlwaysApply: true,
    },
    codex: {
      overlay: '.codex/prompts/opsx-dev-pipeline.md',
      skillsDir: '.codex/prompts',
      expectAlwaysApply: false,
    },
    generic: { overlay: '.ai/README.md', skillsDir: '.ai/skills', expectAlwaysApply: false },
  } as const;

  it.each(
    Object.entries(overlayExpectations),
  )('injects the knowledge-first rule into the %s overlay', async (tool, {
    overlay,
    expectAlwaysApply,
  }) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-overlay-${tool}-`));
    createdDirs.push(dir);

    await runInit({
      dir,
      tool: tool as 'claude' | 'cursor' | 'codex' | 'generic',
      yes: true,
      force: false,
      dryRun: false,
    });

    const content = await fs.readFile(path.join(dir, overlay), 'utf8');
    expect(content).toContain('知识优先');
    expect(content).toContain('.knowledge/INDEX.md');
    expect(content).toContain('追加不覆盖');

    if (expectAlwaysApply) {
      expect(content).toContain('alwaysApply: true');
    }
  });

  it('embeds the new pipeline gates and decision points in skill references', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-gates-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const skillRoot = path.join(dir, '.claude/skills/opsx-dev-pipeline');

    const archive = await fs.readFile(
      path.join(skillRoot, 'references/phase-4-archive.md'),
      'utf8',
    );
    expect(archive).toContain('步骤 15.5');
    expect(archive).toContain('决策点 4c');
    expect(archive).toContain('知识沉淀');

    const apply = await fs.readFile(path.join(skillRoot, 'references/phase-2-apply.md'), 'utf8');
    expect(apply).toContain('写前复用门禁');
    expect(apply).toContain('自审查硬门禁');
    expect(apply).toContain('apply-quality-gate.md');

    const propose = await fs.readFile(
      path.join(skillRoot, 'references/phase-1-propose.md'),
      'utf8',
    );
    expect(propose).toContain('决策点 1c');
    expect(propose).toContain('需求理解确认');

    expect(await fs.pathExists(path.join(skillRoot, 'assets/apply-quality-gate.md'))).toBe(true);
    expect(await fs.pathExists(path.join(skillRoot, 'assets/structural-analysis-hint.md'))).toBe(
      false,
    );

    const skillContent = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    expect(skillContent).not.toContain('structural-analysis-hint.md');

    const decisionIndex = await fs.readFile(
      path.join(skillRoot, 'assets/decision-point-index.md'),
      'utf8',
    );
    expect(decisionIndex).toContain('| 4c |');
    expect(decisionIndex).toContain('| 1c |');
  });

  it('renders tool display name in retained skills without template variables', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-tool-displayname-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    // Verify retained pipeline skill does not leak raw template variables
    const skillContent = await fs.readFile(
      path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'),
      'utf8',
    );
    expect(skillContent).not.toContain('{{toolName}}');
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
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );

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
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );

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

  it('preserves managed assets when sync skips conflicts with yes enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-managed-assets-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    const before = await readManifest(dir);
    const managedCount = before.managedAssets.length;
    expect(managedCount).toBeGreaterThan(0);

    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');
    await runSyncCommand({ dir, yes: true, force: false, dryRun: false });

    const after = await readManifest(dir);
    expect(after.managedAssets.length).toBe(managedCount);
    expect(after.managedAssets.some((asset) => asset.id === 'claude-docs')).toBe(true);
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
    manifest.managedAssets = manifest.managedAssets.filter(
      (asset) => !asset.id.startsWith('common-knowledge-skeleton:'),
    );
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
    manifest.managedAssets = manifest.managedAssets.filter(
      (asset) => !asset.id.startsWith('common-knowledge-skeleton:'),
    );
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

  it('uninstall removes managed files and manifest with yes enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-uninstall-full-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    expect(await readStoredManifest(dir)).not.toBeNull();

    await runUninstallCommand({ dir, yes: true, dryRun: false });

    expect(await readStoredManifest(dir)).toBeNull();
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(dir, '.claude/commands/opsx-dev-pipeline.md'))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(dir, 'CLAUDE.md'))).toBe(false);
  });

  it('uninstall can preserve knowledge skeleton with keep-knowledge', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-uninstall-keep-knowledge-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    await runUninstallCommand({ dir, yes: true, dryRun: false, keepKnowledge: true });

    expect(await fs.pathExists(path.join(dir, '.knowledge/README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      false,
    );

    const manifest = await readManifest(dir);
    expect(
      manifest?.managedAssets.every((asset) => asset.id.startsWith('common-knowledge-skeleton:')),
    ).toBe(true);
  });

  it('sync prompts for conflicts without yes or force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-prompt-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    vi.mocked(prompts).mockResolvedValue({ resolution: 'skip' });
    await runSyncCommand({ dir, yes: false, force: false, dryRun: false });

    expect(vi.mocked(prompts)).toHaveBeenCalled();
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('custom\n');
  });
});
