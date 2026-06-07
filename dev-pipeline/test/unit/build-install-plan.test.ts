import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildInstallPlan } from '../../src/core/init/buildInstallPlan.js';
import type { ToolAdapter, ToolId } from '../../src/core/adapters/types.js';
import type { ManagedAssetRecord } from '../../src/core/manifest/types.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';

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
    rootDir: '/Users/mrzhaoyi/Workspace/LLM/My-Skills/dev-pipeline',
    targetDir: '/tmp/demo',
    projectName: 'demo',
    tool: 'claude' as const,
    features: ['base', 'skills', 'commands', 'docs'],
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
      rootDir: '/Users/mrzhaoyi/Workspace/LLM/My-Skills/dev-pipeline',
      targetDir: '/tmp/demo',
      projectName: 'demo',
      tool,
      features: ['base', 'skills', 'commands', 'docs'],
      dryRun: true,
      force: false,
      mode: 'init',
      registry
    });

    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', MANIFEST_FILE))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', docsPath))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'dev-pipeline', 'SKILL.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'dev-pipeline', 'references', 'phase-0-entrance.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'dev-pipeline', 'assets', 'decision-point-index.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'dev-pipeline', 'scripts', 'dev-pipeline-preflight.sh'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'review.md'))).toBe(true);
  });

  it('skips the managed root README during init when one already exists', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      hasExistingRootReadme: true
    });

    expect(plan.files.some((file) => file.assetId === 'common-readme')).toBe(false);
  });

  it('keeps the managed root README during init when force is enabled', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      force: true,
      hasExistingRootReadme: true
    });

    expect(plan.files.some((file) => file.assetId === 'common-readme')).toBe(true);
  });

  it('limits sync plans to manifest-managed assets', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' },
      { id: 'common-metadata', destination: MANIFEST_FILE }
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync'
    });

    expect(plan.files.map((file) => file.assetId).sort()).toEqual(['common-metadata', 'common-readme']);
  });
});
