import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateTarget } from '../../src/core/init/validateTarget.js';
import type { ToolAdapter, ToolId } from '../../src/core/adapters/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-validate-target-'));
  createdDirs.push(dir);
  return dir;
}

function createMockAdapter(markers: string[]): ToolAdapter {
  return {
    definition: {
      id: 'claude' as ToolId,
      displayName: 'Claude',
      description: '',
      markers,
      destinations: { root: '.claude', skills: '.claude/skills', commands: '.claude/commands' },
      supports: ['base'],
    },
    detectFiles: () => markers,
    supports: () => true,
    getDestination: () => '',
    getRoot: () => '.claude',
    getSkillRootNote: () => undefined,
    getPostInstallNotes: () => [],
  };
}

function createRegistry(
  entries: Array<{ toolId: ToolId; markers: string[] }>,
): Map<ToolId, ToolAdapter> {
  const map = new Map<ToolId, ToolAdapter>();
  for (const { toolId, markers } of entries) {
    map.set(toolId, createMockAdapter(markers));
  }
  return map;
}

describe('validateTarget', () => {
  it('returns empty existingEntries for an empty directory', async () => {
    const dir = await createTempDir();
    const registry = createRegistry([{ toolId: 'claude', markers: ['.claude/'] }]);

    const result = await validateTarget(dir, registry);

    expect(result.existingEntries).toEqual([]);
    expect(result.suggestedTool).toBeUndefined();
  });

  it('detects cursor tool when .cursor/rules/ marker exists', async () => {
    const dir = await createTempDir();
    await fs.ensureDir(path.join(dir, '.cursor', 'rules'));

    const registry = createRegistry([
      { toolId: 'claude', markers: ['.claude/'] },
      { toolId: 'cursor', markers: ['.cursor/rules/'] },
      { toolId: 'codex', markers: ['.codex/'] },
    ]);

    const result = await validateTarget(dir, registry);

    expect(result.suggestedTool).toBe('cursor');
  });

  it('detects claude tool when .claude/ marker exists', async () => {
    const dir = await createTempDir();
    await fs.ensureDir(path.join(dir, '.claude'));

    const registry = createRegistry([
      { toolId: 'claude', markers: ['.claude/'] },
      { toolId: 'cursor', markers: ['.cursor/rules/'] },
      { toolId: 'codex', markers: ['.codex/'] },
    ]);

    const result = await validateTarget(dir, registry);

    expect(result.suggestedTool).toBe('claude');
  });

  it('detects codex tool when .codex/ marker exists', async () => {
    const dir = await createTempDir();
    await fs.ensureDir(path.join(dir, '.codex'));

    const registry = createRegistry([
      { toolId: 'claude', markers: ['.claude/'] },
      { toolId: 'cursor', markers: ['.cursor/rules/'] },
      { toolId: 'codex', markers: ['.codex/'] },
    ]);

    const result = await validateTarget(dir, registry);

    expect(result.suggestedTool).toBe('codex');
  });

  it('excludes safe files from existingEntries', async () => {
    const dir = await createTempDir();
    // Create safe files that should be excluded
    await fs.ensureDir(path.join(dir, '.git'));
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules');
    await fs.writeFile(path.join(dir, 'README.md'), '# test');
    await fs.writeFile(path.join(dir, 'package.json'), '{}');
    await fs.writeFile(path.join(dir, 'package-lock.json'), '{}');
    // Create a non-safe file that should appear
    await fs.writeFile(path.join(dir, 'src'), '');
    await fs.ensureDir(path.join(dir, 'node_modules'));

    const registry = createRegistry([{ toolId: 'claude', markers: ['.claude/'] }]);

    const result = await validateTarget(dir, registry);

    // node_modules is also in SAFE_FILES, so it should be excluded
    expect(result.existingEntries).toEqual(expect.arrayContaining(['src']));
    expect(result.existingEntries).not.toEqual(
      expect.arrayContaining(['.git', '.gitignore', 'README.md', 'package.json', 'package-lock.json', 'node_modules']),
    );
  });

  it('returns undefined suggestedTool when no marker matches', async () => {
    const dir = await createTempDir();
    await fs.ensureDir(path.join(dir, 'src'));

    const registry = createRegistry([
      { toolId: 'claude', markers: ['.claude/'] },
      { toolId: 'cursor', markers: ['.cursor/rules/'] },
    ]);

    const result = await validateTarget(dir, registry);

    expect(result.suggestedTool).toBeUndefined();
    expect(result.existingEntries).toEqual(['src']);
  });
});
