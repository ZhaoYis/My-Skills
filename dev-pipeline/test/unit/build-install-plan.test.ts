import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildInstallPlan } from '../../src/core/init/buildInstallPlan.js';
import type { ToolAdapter, ToolId } from '../../src/core/adapters/types.js';
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

describe('buildInstallPlan', () => {
  it.each([
    ['claude', '.claude/skills', '.claude/commands', 'CLAUDE.md'],
    ['cursor', '.cursor/rules', '.cursor/commands', '.cursor/rules/opsx-dev-pipeline.mdc'],
    ['codex', '.codex/prompts', '.codex/commands', '.codex/prompts/opsx-dev-pipeline.md'],
    ['generic', '.ai/skills', '.ai/commands', '.ai/README.md']
  ] as const)('maps assets for %s', (tool, skillsDir, commandsDir, docsPath) => {
    const adapter = createAdapter(tool, skillsDir, commandsDir, tool);
    const registry = new Map<ToolId, ToolAdapter>([[tool, adapter]]);

    const plan = buildInstallPlan({
      rootDir: '/repo',
      targetDir: '/tmp/demo',
      projectName: 'demo',
      tool,
      features: ['base', 'skills', 'commands', 'docs'],
      dryRun: true,
      force: false,
      registry
    });

    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', MANIFEST_FILE))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', docsPath))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', skillsDir, 'project-planner.md'))).toBe(true);
    expect(plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', commandsDir, 'review.md'))).toBe(true);
  });
});
