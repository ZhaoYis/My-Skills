import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildInstallPlan } from '../../src/core/init/buildInstallPlan.js';
import { DEFAULT_FEATURES, type FeatureId, type ToolAdapter, type ToolId } from '../../src/core/adapters/types.js';
import type { ManagedAssetRecord } from '../../src/core/manifest/types.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempTargetDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-build-plan-'));
  createdDirs.push(dir);
  return dir;
}

function createAdapter(id: ToolId, skills: string, commands: string, displayName: string): ToolAdapter {
  return {
    definition: {
      id,
      displayName,
      description: `${displayName} adapter`,
      markers: [skills.split('/')[0]],
      destinations: {
        root: '.',
        skills,
        commands
      },
      supports: ['base', 'skills', 'commands', 'docs']
    },
    detectFiles: () => [skills.split('/')[0]],
    supports: () => true,
    getDestination: (feature) => feature === 'skills' ? skills : commands,
    getRoot: () => '.',
    getPostInstallNotes: () => ['note']
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
    features: [...DEFAULT_FEATURES],
    dryRun: true,
    force: false,
    mode: 'init' as const,
    managedAssets,
    registry
  };
}

describe('buildInstallPlan', () => {
  it.each([
    ['claude', '.claude/skills', '.claude/commands', 'CLAUDE.md'],
    ['cursor', '.cursor/rules', '.cursor/commands', '.cursor/rules/opsx-dev-pipeline.mdc'],
    ['codex', '.codex/prompts', '.codex/commands', '.codex/prompts/opsx-dev-pipeline.md'],
    ['generic', '.ai/skills', '.ai/commands', '.ai/README.md']
  ] as const)('maps assets for %s including bundle skill', async (tool, skillsDir, commandsDir, docsPath) => {
    const adapter = createAdapter(tool, skillsDir, commandsDir, tool);
    const registry = new Map<ToolId, ToolAdapter>([[tool, adapter]]);

    const plan = await buildInstallPlan({
      rootDir: PACKAGE_ROOT,
      targetDir: '/tmp/demo',
      projectName: 'demo',
      tool,
      features: [...DEFAULT_FEATURES],
      dryRun: true,
      force: false,
      mode: 'init',
      registry
    });

    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', docsPath))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', '.knowledge', 'README.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', '.knowledge', 'INDEX.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', '.knowledge', 'tech', 'development-experience.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'references', 'phase-0-entrance.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'assets', 'decision-point-index.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'scripts', 'dev-pipeline-preflight.sh'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-learn', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-learn', 'references', 'phase-1-understand-goal.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-learn', 'assets', 'write-targets.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-learn', 'scripts', 'opsx-learn-preflight.sh'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'references', 'phase-1-clarify-requirement.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'references', 'phase-2-explore-context.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'references', 'phase-3-split-capabilities.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'references', 'phase-4-assess-impact.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'references', 'phase-5-output-analysis.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'assets', 'analysis-output-template.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'assets', 'evidence-standards.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'assets', 'maintenance-index.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'assets', 'question-checklist.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'opsx-analysis', 'scripts', 'opsx-analysis-preflight.sh'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'git-commit-push', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'git-code-review', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'git-merge-branch', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'file-code-review', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'git-commit-push.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'git-code-review.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'git-merge-branch.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'file-code-review.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'opsx-learn.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'opsx-analysis.md'))).toBe(true);
  });

  it('marks existing files as unresolved during init without force', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput()
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
      force: true
    });

    const readmeFile = plan.files.find((file) => file.assetId === 'common-readme');
    expect(readmeFile?.resolution).toBe('overwrite');
  });

  it('marks sync files as unresolved without force', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' }
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync'
    });

    expect(plan.files[0]?.resolution).toBe('none');
  });

  it('keeps the managed root .gitignore during init when force is enabled', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      force: true
    });

    const gitignoreFile = plan.files.find((file) => file.assetId === 'common-gitignore');
    expect(gitignoreFile?.resolution).toBe('none');
  });

  it('limits sync plans to manifest-managed assets and full managed bundles', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' },
      { id: 'opsx-learn-command', destination: '.claude/commands/opsx-learn.md' },
      { id: 'opsx-learn-skill-bundle:SKILL.md.hbs', destination: '.claude/skills/opsx-learn/SKILL.md' }
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync'
    });

    const assetIds = plan.files.map((file) => file.assetId).sort();
    expect(assetIds).toContain('common-readme');
    expect(assetIds).toContain('opsx-learn-command');
    expect(assetIds).toContain('opsx-learn-skill-bundle:SKILL.md.hbs');
    expect(assetIds.every((id) => id === 'common-readme' || id.startsWith('opsx-learn'))).toBe(true);
    expect(assetIds.some((id) => id.startsWith('opsx-dev-pipeline'))).toBe(false);
  });

  it('omits structural-analysis-hint unless the feature is enabled', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      features: [...DEFAULT_FEATURES]
    });

    expect(
      plan.files.some((file) => file.assetId.endsWith('assets/structural-analysis-hint.md'))
    ).toBe(false);
  });

  it('includes structural-analysis-hint when the feature is enabled', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      features: [...DEFAULT_FEATURES, 'structural-analysis-hint']
    });

    expect(
      plan.files.some((file) => file.assetId.endsWith('assets/structural-analysis-hint.md'))
    ).toBe(true);
  });

  it('adopts newly added package assets during upgrade', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' }
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'upgrade',
      allowUpgradeAdoption: false
    });

    expect(plan.files.some((file) => file.assetId === 'opsx-learn-command')).toBe(true);
    expect(plan.files.some((file) => file.assetId.startsWith('opsx-learn-skill-bundle:'))).toBe(true);
  });

  it('adopts knowledge skeleton files during upgrade when allowed', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' }
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'upgrade',
      allowUpgradeAdoption: true
    });

    expect(plan.files.some((file) => file.assetId === 'common-readme')).toBe(true);
    expect(plan.files.some((file) => file.assetId === 'common-knowledge-skeleton:README.md.hbs')).toBe(true);
    expect(plan.files.some((file) => file.assetId === 'common-knowledge-skeleton:INDEX.md')).toBe(true);
  });

  it('does not adopt knowledge skeleton files during sync for legacy manifests', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' }
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync'
    });

    expect(plan.files.some((file) => file.assetId.startsWith('common-knowledge-skeleton:'))).toBe(false);
  });
});
