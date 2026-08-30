import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInit } from '../../../src/core/init/runInit.js';
import { readManifest } from '../../../src/core/manifest/io.js';
import { cleanupDirectories } from '../../helpers/cleanup.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

const createdDirs: string[] = [];

afterEach(async () => {
  await cleanupDirectories(createdDirs.splice(0));
  vi.mocked(prompts).mockReset();
});

async function initToTmp(options: Parameters<typeof runInit>[0]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hooks-'));
  createdDirs.push(dir);
  await runInit({ ...options, dir });
  return dir;
}

describe('pipeline hooks integration', () => {
  it('writes hook scripts + .claude/settings.json for --tool claude', async () => {
    const dir = await initToTmp({
      tool: 'claude',
      stack: 'backend',
      yes: true,
      force: false,
      dryRun: false,
    });

    const bashHook = path.join(
      dir,
      '.claude/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs',
    );
    const writeHook = path.join(
      dir,
      '.claude/skills/opsx-dev-pipeline/scripts/hooks/block-sensitive-write.mjs',
    );
    const settings = path.join(dir, '.claude/settings.json');

    expect(await fs.pathExists(bashHook)).toBe(true);
    expect(await fs.pathExists(writeHook)).toBe(true);
    expect(await fs.pathExists(settings)).toBe(true);

    // Hooks are tracked in manifest (so sync/upgrade re-renders them).
    const result = await readManifest(dir);
    expect(result).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: narrowed by expect(result).not.toBeNull() above
    const manifest = result!.manifest;
    const bashAsset = manifest.managedAssets.find((a) => a.id.endsWith('block-dangerous-bash.mjs'));
    const writeAsset = manifest.managedAssets.find((a) =>
      a.id.endsWith('block-sensitive-write.mjs'),
    );
    expect(bashAsset).toBeDefined();
    expect(writeAsset).toBeDefined();
  });

  // Exec bits are a POSIX concept; Windows cannot set or observe them.
  it.skipIf(process.platform === 'win32')('hook scripts are executable (chmod +x)', async () => {
    const dir = await initToTmp({
      tool: 'claude',
      stack: 'backend',
      yes: true,
      force: false,
      dryRun: false,
    });

    const bashHook = path.join(
      dir,
      '.claude/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs',
    );
    const stat = await fs.stat(bashHook);
    // S_IXUSR bit set => owner can execute
    expect(stat.mode & 0o100).not.toBe(0);
  });

  it('.claude/settings.json is valid JSON with both PreToolUse hooks', async () => {
    const dir = await initToTmp({
      tool: 'claude',
      stack: 'backend',
      yes: true,
      force: false,
      dryRun: false,
    });

    const settingsPath = path.join(dir, '.claude/settings.json');
    const parsed = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    expect(parsed.hooks.PreToolUse).toHaveLength(2);
    expect(parsed._opsxManaged.hooksEnabled).toBe(true);

    const matchers = parsed.hooks.PreToolUse.map((e: { matcher: string }) => e.matcher);
    expect(matchers).toContain('Bash');
    expect(matchers).toContain('Write|Edit|MultiEdit');
  });

  it('writes opencode.json + hook scripts for --tool opencode', async () => {
    const dir = await initToTmp({
      tool: 'opencode',
      stack: 'frontend',
      yes: true,
      force: false,
      dryRun: false,
    });

    const opencodeConfig = path.join(dir, '.opencode/opencode.json');
    expect(await fs.pathExists(opencodeConfig)).toBe(true);

    const parsed = JSON.parse(await fs.readFile(opencodeConfig, 'utf8'));
    expect(parsed.hooks.PreToolUse).toHaveLength(2);
    const matchers = parsed.hooks.PreToolUse.map((e: { matcher: string }) => e.matcher);
    expect(matchers).toContain('bash');
    expect(matchers).toContain('write|edit|multi_edit');
  });

  it('--feature no-hooks skips hook assets entirely', async () => {
    const dir = await initToTmp({
      tool: 'claude',
      stack: 'backend',
      yes: true,
      force: false,
      dryRun: false,
      feature: ['no-hooks'],
    });

    // With no-hooks, no settings.json or hook scripts are written
    expect(await fs.pathExists(path.join(dir, '.claude/settings.json'))).toBe(false);
    expect(
      await fs.pathExists(
        path.join(dir, '.claude/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs'),
      ),
    ).toBe(false);

    // Manifest excludes `hooks` from features list
    const result = await readManifest(dir);
    expect(result?.manifest.features).not.toContain('hooks');
  });

  it('--feature hooks + --feature no-hooks is a mutex violation', async () => {
    await expect(
      runInit({
        tool: 'claude',
        stack: 'backend',
        yes: true,
        force: false,
        dryRun: false,
        dir: await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hooks-mutex-')),
        feature: ['hooks', 'no-hooks'],
      }),
    ).rejects.toThrow(/互斥/);
  });

  it('cursor + codex do not render hook templates (mode=manual)', async () => {
    for (const tool of ['cursor', 'codex'] as const) {
      const dir = await initToTmp({
        tool,
        stack: 'backend',
        yes: true,
        force: false,
        dryRun: false,
      });

      // Neither .claude/settings.json nor .opencode/opencode.json should exist
      expect(
        await fs.pathExists(path.join(dir, '.claude/settings.json')),
        `unexpected .claude/settings.json for ${tool}`,
      ).toBe(false);
      expect(
        await fs.pathExists(path.join(dir, '.opencode/opencode.json')),
        `unexpected .opencode/opencode.json for ${tool}`,
      ).toBe(false);
    }
  });
});
