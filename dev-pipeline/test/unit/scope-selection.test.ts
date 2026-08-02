import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadToolRegistry } from '../../src/core/adapters/registry.js';
import type { ToolAdapter, ToolId } from '../../src/core/adapters/types.js';
import { assetManifest } from '../../src/core/assets/manifest.js';
import { buildInstallPlan } from '../../src/core/init/buildInstallPlan.js';
import { collectInputs } from '../../src/core/init/collectInputs.js';
import { resolvePackageRoot } from '../../src/core/runtime/resolvePackageRoot.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('scope selection (user vs project)', () => {
  describe('adapter registry', () => {
    it('resolves project-level destinations for each tool', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      for (const toolId of ['claude', 'cursor', 'codex'] as const) {
        const adapter = registry.get(toolId);
        expect(adapter).toBeDefined();
        expect(adapter!.getDestination('skills', 'project')).toBe(adapter!.definition.destinations.skills);
        expect(adapter!.getDestination('commands', 'project')).toBe(adapter!.definition.destinations.commands);
      }
    });

    it('resolves user-level destinations as absolute paths under home directory', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);
      const adapter = registry.get('claude')!;

      expect(adapter.getDestination('skills', 'user')).toBe(
        path.join(os.homedir(), adapter.definition.userDestinations?.skills ?? ''),
      );
      expect(adapter.getDestination('commands', 'user')).toBe(
        path.join(os.homedir(), adapter.definition.userDestinations?.commands ?? ''),
      );
    });

    it('reports user destination support per feature', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      // Claude Code supports both skills and commands at user scope
      const claude = registry.get('claude')!;
      expect(claude.supportsUserDestination('skills')).toBe(true);
      expect(claude.supportsUserDestination('commands')).toBe(true);

      // Cursor supports both skills and commands at user scope
      const cursor = registry.get('cursor')!;
      expect(cursor.supportsUserDestination('skills')).toBe(true);
      expect(cursor.supportsUserDestination('commands')).toBe(true);

      // Codex supports only skills at user scope, not commands
      const codex = registry.get('codex')!;
      expect(codex.supportsUserDestination('skills')).toBe(true);
      expect(codex.supportsUserDestination('commands')).toBe(false);
    });

    it('defaults to project scope when no scope is passed to getDestination', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);
      const adapter = registry.get('claude')!;

      // Without explicit scope, should use project destinations
      const skillsDir = adapter.getDestination('skills');
      expect(skillsDir).toBe(adapter.definition.destinations.skills);
      expect(path.isAbsolute(skillsDir)).toBe(false);
    });
  });

  describe('collectInputs', () => {
    function createMockRegistry(): Map<ToolId, ToolAdapter> {
      return new Map([
        [
          'claude' as ToolId,
          {
            definition: {
              id: 'claude',
              displayName: 'Claude Code',
              description: 'Claude adapter',
              markers: ['.claude'],
              destinations: { root: '.', skills: '.claude/skills', commands: '.claude/commands' },
              supports: ['base', 'skills', 'commands', 'docs'],
            },
            detectFiles: () => ['.claude'],
            supports: () => true,
            getDestination: (feature, scope) =>
              scope === 'user'
                ? path.join(os.homedir(), feature === 'skills' ? '.claude/skills' : '.claude/commands')
                : feature === 'skills'
                  ? '.claude/skills'
                  : '.claude/commands',
            supportsUserDestination: () => true,
            getRoot: () => '.',
            getSkillRootNote: () => undefined,
            getPostInstallNotes: () => [],
          },
        ],
      ]);
    }

    it('defaults to project scope in non-interactive mode', async () => {
      const answers = await collectInputs(
        '/tmp/demo',
        { yes: true, stack: 'backend' },
        createMockRegistry(),
      );

      expect(answers.scope).toBe('project');
    });

    it('accepts explicit user scope in non-interactive mode', async () => {
      const answers = await collectInputs(
        '/tmp/demo',
        { yes: true, stack: 'backend', scope: 'user' },
        createMockRegistry(),
      );

      expect(answers.scope).toBe('user');
    });

    it('accepts explicit project scope in non-interactive mode', async () => {
      const answers = await collectInputs(
        '/tmp/demo',
        { yes: true, stack: 'backend', scope: 'project' },
        createMockRegistry(),
      );

      expect(answers.scope).toBe('project');
    });

    it('rejects invalid scope values', async () => {
      await expect(
        collectInputs(
          '/tmp/demo',
          { yes: true, stack: 'backend', scope: 'invalid' as 'user' },
          createMockRegistry(),
        ),
      ).rejects.toThrow('Invalid scope: invalid. Valid scopes: user, project.');
    });

    it('includes scope prompt in interactive mode', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({
        projectName: 'demo',
        tool: 'claude',
        stack: 'backend',
        language: 'zh',
        scope: 'user',
      });

      const answers = await collectInputs('/tmp/demo', {}, createMockRegistry());
      const questions = vi.mocked(prompts).mock.calls[0]?.[0];

      const scopeQuestion = Array.isArray(questions)
        ? questions.find((question) => question.name === 'scope')
        : undefined;

      expect(scopeQuestion).toBeDefined();
      expect(scopeQuestion?.type).toBe('select');
      expect(answers.scope).toBe('user');
    });

    it('defaults to project scope when interactive user picks nothing', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({
        projectName: 'demo',
        tool: 'claude',
        stack: 'backend',
        language: 'zh',
      });

      const answers = await collectInputs('/tmp/demo', {}, createMockRegistry());

      expect(answers.scope).toBe('project');
    });
  });

  describe('buildInstallPlan', () => {
    it('uses project-level destinations when scope is project', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      const plan = await buildInstallPlan({
        rootDir,
        targetDir: '/tmp/demo',
        projectName: 'demo',
        tool: 'claude',
        features: ['base', 'skills', 'commands', 'docs'],
        scope: 'project',
        dryRun: true,
        force: false,
        mode: 'init',
        registry,
      });

      // Project-level skills go to relative paths
      const skillFile = plan.files.find(
        (file) => file.assetId === 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
      );
      expect(skillFile).toBeDefined();
      expect(skillFile!.destinationPath).toContain('.claude/skills/opsx-dev-pipeline');
      expect(path.isAbsolute('.claude/skills')).toBe(false);
    });

    it('uses user-level absolute destinations when scope is user', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      const plan = await buildInstallPlan({
        rootDir,
        targetDir: '/tmp/demo',
        projectName: 'demo',
        tool: 'claude',
        features: ['base', 'skills', 'commands', 'docs'],
        scope: 'user',
        dryRun: true,
        force: false,
        mode: 'init',
        registry,
      });

      const skillFile = plan.files.find(
        (file) => file.assetId === 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
      );
      expect(skillFile).toBeDefined();
      expect(skillFile!.destinationPath).toContain(path.join(os.homedir(), '.claude/skills/opsx-dev-pipeline'));
    });

    it('filters out commands feature for codex at user scope', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      const plan = await buildInstallPlan({
        rootDir,
        targetDir: '/tmp/demo',
        projectName: 'demo',
        tool: 'codex',
        features: ['base', 'skills', 'commands', 'docs'],
        scope: 'user',
        dryRun: true,
        force: false,
        mode: 'init',
        registry,
      });

      // Commands should be filtered out since codex doesn't support user-level commands
      const commandFiles = plan.files.filter((file) => file.assetId.includes('-command'));
      expect(commandFiles).toHaveLength(0);

      // Skills should still be present
      const skillFiles = plan.files.filter((file) => file.assetId.includes('-skill-bundle:'));
      expect(skillFiles.length).toBeGreaterThan(0);

      // Docs should still be present
      const docsFiles = plan.files.filter((file) => file.assetId === 'codex-docs');
      expect(docsFiles.length).toBe(1);
    });

    it('keeps all features for codex at project scope', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      const plan = await buildInstallPlan({
        rootDir,
        targetDir: '/tmp/demo',
        projectName: 'demo',
        tool: 'codex',
        features: ['base', 'skills', 'commands', 'docs'],
        scope: 'project',
        dryRun: true,
        force: false,
        mode: 'init',
        registry,
      });

      // Commands should be present at project scope
      const commandFiles = plan.files.filter((file) => file.assetId.includes('-command'));
      expect(commandFiles.length).toBeGreaterThan(0);
    });

    it('stores scope in the install plan', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      const plan = await buildInstallPlan({
        rootDir,
        targetDir: '/tmp/demo',
        projectName: 'demo',
        tool: 'claude',
        features: ['base', 'skills', 'commands', 'docs'],
        scope: 'user',
        dryRun: true,
        force: false,
        mode: 'init',
        registry,
      });

      expect(plan.scope).toBe('user');
    });
  });

  describe('tool config', () => {
    it('has userDestinations for all three tools', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      for (const toolId of ['claude', 'cursor', 'codex'] as const) {
        const adapter = registry.get(toolId);
        expect(adapter!.definition.userDestinations).toBeDefined();
        expect(adapter!.definition.userDestinations?.skills).toBeDefined();
      }
    });

    it('has userDestinations.commands for claude and cursor, but not codex', async () => {
      const rootDir = await resolvePackageRoot(import.meta.url);
      const registry = await loadToolRegistry(rootDir);

      expect(registry.get('claude')!.definition.userDestinations?.commands).toBeDefined();
      expect(registry.get('cursor')!.definition.userDestinations?.commands).toBeDefined();
      expect(registry.get('codex')!.definition.userDestinations?.commands).toBeUndefined();
    });
  });
});