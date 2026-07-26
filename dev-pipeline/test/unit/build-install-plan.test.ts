import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_FEATURE_IDS, type ToolAdapter, type ToolId } from '../../src/core/adapters/types.js';
import { buildInstallPlan } from '../../src/core/init/buildInstallPlan.js';
import { renderTemplate } from '../../src/core/init/renderTemplates.js';
import type { ManagedAssetRecord } from '../../src/core/manifest/types.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const createdDirs: string[] = [];
const standaloneCommands = ['propose', 'apply', 'archive', 'verify', 'sync', 'explore'] as const;

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempTargetDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-build-plan-'));
  createdDirs.push(dir);
  return dir;
}

function createAdapter(
  id: ToolId,
  skills: string,
  commands: string,
  displayName: string,
): ToolAdapter {
  return {
    definition: {
      id,
      displayName,
      description: `${displayName} adapter`,
      markers: [skills.split('/')[0]],
      destinations: {
        root: '.',
        skills,
        commands,
      },
      supports: ['base', 'skills', 'commands', 'docs'],
    },
    detectFiles: () => [skills.split('/')[0]],
    supports: () => true,
    getDestination: (feature) => (feature === 'skills' ? skills : commands),
    getRoot: () => '.',
    getPostInstallNotes: () => ['note'],
  };
}

function createPlanInput(managedAssets?: ManagedAssetRecord[]) {
  const adapter = createAdapter('claude', '.claude/skills', '.claude/commands', 'claude');
  const registry = new Map<ToolId, ToolAdapter>([['claude', adapter]]);

  return {
    rootDir: PACKAGE_ROOT,
    targetDir: '/tmp/demo',
    projectName: 'demo',
    tool: 'claude' as const,
    features: [...ALL_FEATURE_IDS],
    dryRun: true,
    force: false,
    mode: 'init' as const,
    managedAssets,
    registry,
  };
}

describe('buildInstallPlan', () => {
  it.each([
    ['claude', '.claude/skills', '.claude/commands', 'CLAUDE.md'],
    ['cursor', '.cursor/rules', '.cursor/commands', '.cursor/rules/opsx-dev-pipeline.mdc'],
    ['codex', '.codex/prompts', '.codex/commands', '.codex/prompts/opsx-dev-pipeline.md'],
  ] as const)('maps assets for %s including bundle skill', async (tool, skillsDir, commandsDir, docsPath) => {
    const adapter = createAdapter(tool, skillsDir, commandsDir, tool);
    const registry = new Map<ToolId, ToolAdapter>([[tool, adapter]]);

    const plan = await buildInstallPlan({
      rootDir: PACKAGE_ROOT,
      targetDir: '/tmp/demo',
      projectName: 'demo',
      tool,
      features: [...ALL_FEATURE_IDS],
      dryRun: true,
      force: false,
      mode: 'init',
      registry,
    });

    expect(
      plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', docsPath)),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'SKILL.md'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join(
            '/tmp/demo',
            skillsDir,
            'opsx-dev-pipeline',
            'references',
            'phase-0-entrance.md',
          ),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'scripts', 'archive.mjs'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'scripts', 'preflight.mjs'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath === path.join('/tmp/demo', commandsDir, 'opsx-dev-pipeline.md'),
      ),
    ).toBe(true);
    for (const command of standaloneCommands) {
      expect(
        plan.files.some(
          (file) =>
            file.destinationPath === path.join('/tmp/demo', commandsDir, 'opsx', `${command}.md`),
        ),
      ).toBe(true);
    }
    // negative: no removed preset skills or commands in plan
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
    for (const name of removed) {
      expect(plan.files.some((file) => file.destinationPath.includes(name))).toBe(false);
    }
  });

  it('marks existing files as unresolved during init without force', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
    });

    const readmeFile = plan.files.find((file) => file.assetId === 'common-readme');
    expect(readmeFile?.resolution).toBe('none');
  });

  it('marks existing files as overwrite when force is enabled', async () => {
    const targetDir = await createTempTargetDir();
    await fs.writeFile(path.join(targetDir, 'README.md'), '# existing\n');

    const plan = await buildInstallPlan({
      ...createPlanInput(),
      targetDir,
      force: true,
    });

    const readmeFile = plan.files.find((file) => file.assetId === 'common-readme');
    expect(readmeFile?.resolution).toBe('overwrite');
  });

  it('replaces OpenSpec-generated command entries only during init', async () => {
    const targetDir = await createTempTargetDir();
    const commandPath = path.join(targetDir, '.claude/commands/opsx/propose.md');
    await fs.ensureDir(path.dirname(commandPath));
    await fs.writeFile(commandPath, '# OpenSpec generated\n');
    await fs.writeFile(path.join(targetDir, 'README.md'), '# existing\n');

    const initPlan = await buildInstallPlan({ ...createPlanInput(), targetDir });
    expect(initPlan.files.find((file) => file.assetId === 'opsx-propose-command')?.resolution).toBe(
      'overwrite',
    );
    expect(initPlan.files.find((file) => file.assetId === 'common-readme')?.resolution).toBe(
      'unresolved',
    );

    const syncPlan = await buildInstallPlan({
      ...createPlanInput([
        { id: 'opsx-propose-command', destination: '.claude/commands/opsx/propose.md' },
      ]),
      targetDir,
      mode: 'sync',
    });
    expect(syncPlan.files).toHaveLength(1);
    expect(syncPlan.files[0]).toMatchObject({
      assetId: 'opsx-propose-command',
      resolution: 'unresolved',
    });
  });

  it.each([
    ['.claude/skills', '.claude/commands'],
    ['.cursor/rules', '.cursor/commands'],
    ['.codex/prompts', '.codex/commands'],
  ] as const)('renders standalone command templates for %s', async (skillsDir, commandsDir) => {
    for (const command of standaloneCommands) {
      const rendered = await renderTemplate(
        path.join(PACKAGE_ROOT, 'templates/common/commands/opsx', `${command}.md.hbs`),
        { skillsDir, commandsDir },
      );

      expect(rendered).toContain(
        `node ${skillsDir}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs`,
      );
      expect(rendered).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });

  it('marks sync files as unresolved without force', async () => {
    const managedAssets: ManagedAssetRecord[] = [{ id: 'common-readme', destination: 'README.md' }];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync',
    });

    expect(plan.files[0]?.resolution).toBe('none');
  });

  it('keeps the managed root .gitignore during init when force is enabled', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      force: true,
    });

    const gitignoreFile = plan.files.find((file) => file.assetId === 'common-gitignore');
    expect(gitignoreFile?.resolution).toBe('none');
  });

  it('limits sync plans to manifest-managed assets and full managed bundles', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' },
      { id: 'opsx-dev-pipeline-command', destination: '.claude/commands/opsx-dev-pipeline.md' },
      {
        id: 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
        destination: '.claude/skills/opsx-dev-pipeline/SKILL.md',
      },
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync',
    });

    const assetIds = plan.files.map((file) => file.assetId).sort();
    expect(assetIds).toContain('common-readme');
    expect(assetIds).toContain('opsx-dev-pipeline-command');
    expect(assetIds).toContain('opsx-dev-pipeline-skill-bundle:SKILL.md.hbs');
    expect(
      assetIds.every((id) => id === 'common-readme' || id.startsWith('opsx-dev-pipeline')),
    ).toBe(true);
  });

  it('adopts newly added package assets during upgrade', async () => {
    const managedAssets: ManagedAssetRecord[] = [{ id: 'common-readme', destination: 'README.md' }];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'upgrade',
    });

    expect(plan.files.some((file) => file.assetId === 'opsx-dev-pipeline-command')).toBe(true);
    expect(
      plan.files.some((file) => file.assetId.startsWith('opsx-dev-pipeline-skill-bundle:')),
    ).toBe(true);
  });
});
