import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { runUninstallCommand } from '../../../src/cli/commands/uninstall.js';
import { loadToolRegistry } from '../../../src/core/adapters/registry.js';
import { buildInstallPlan } from '../../../src/core/init/buildInstallPlan.js';
import { executeInstallPlan } from '../../../src/core/init/executeInstallPlan.js';
import { readManifest } from '../../../src/core/manifest/io.js';
import { MANIFEST_FILE } from '../../../src/core/runtime/meta.js';
import { PACKAGE_ROOT } from '../../helpers/package-root.js';

const createdDirs: string[] = [];
afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createPlan(
  targetDir: string,
  tool: 'claude' | 'opencode',
  mode: 'init' | 'sync' | 'upgrade',
  force = false,
) {
  return buildInstallPlan({
    rootDir: PACKAGE_ROOT,
    targetDir,
    projectName: 'demo',
    tool,
    stack: 'backend',
    features: ['hooks'],
    scope: 'project',
    dryRun: false,
    force,
    mode,
    managedAssets: (await readManifest(targetDir))?.manifest.managedAssets,
    registry: await loadToolRegistry(PACKAGE_ROOT),
  });
}

describe('Hook config preservation', () => {
  it.each([
    'claude',
    'opencode',
  ] as const)('preserves %s user settings across init, repeated sync and forced upgrade', async (tool) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hook-config-'));
    createdDirs.push(dir);
    const configPath = path.join(
      dir,
      tool === 'claude' ? '.claude' : '.opencode',
      tool === 'claude' ? 'settings.json' : 'opencode.json',
    );
    const userConfig = {
      permissions: { deny: ['Bash(rm:*)'] },
      customSetting: { enabled: true },
      hooks: {
        PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node after.mjs' }] }],
        PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node before.mjs' }] }],
      },
    };
    await fs.outputJson(configPath, userConfig);
    await executeInstallPlan(await createPlan(dir, tool, 'init'));
    const first = await fs.readFile(configPath, 'utf8');
    await executeInstallPlan(await createPlan(dir, tool, 'sync'));
    await executeInstallPlan(await createPlan(dir, tool, 'sync'));
    await executeInstallPlan(await createPlan(dir, tool, 'upgrade', true));
    const final = await fs.readFile(configPath, 'utf8');
    expect(final).toBe(first);
    const result = JSON.parse(final);
    expect(result.permissions).toEqual(userConfig.permissions);
    expect(result.customSetting).toEqual(userConfig.customSetting);
    expect(result.hooks.PostToolUse).toEqual(userConfig.hooks.PostToolUse);
    expect(result.hooks.PreToolUse).toHaveLength(3);
    expect(result.hooks.PreToolUse[0]).toEqual(userConfig.hooks.PreToolUse[0]);

    await runUninstallCommand({ dir, yes: true });
    const uninstalled = await fs.readJson(configPath);
    expect(uninstalled.permissions).toEqual(userConfig.permissions);
    expect(uninstalled.customSetting).toEqual(userConfig.customSetting);
    expect(uninstalled.hooks).toEqual(userConfig.hooks);
    expect(uninstalled._opsxManaged).toBeUndefined();
    expect(await readManifest(dir)).toBeNull();
  });

  it('deletes a generated Hook config when uninstall has no user settings to retain', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hook-uninstall-'));
    createdDirs.push(dir);
    await executeInstallPlan(await createPlan(dir, 'claude', 'init'));
    await runUninstallCommand({ dir, yes: true });
    expect(await fs.pathExists(path.join(dir, '.claude', 'settings.json'))).toBe(false);
    expect(await readManifest(dir)).toBeNull();
  });

  it('partial uninstall preserves user settings and the surviving Tool configuration', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hook-uninstall-one-'));
    createdDirs.push(dir);
    const claudeConfig = path.join(dir, '.claude', 'settings.json');
    const opencodeConfig = path.join(dir, '.opencode', 'opencode.json');
    await fs.outputJson(claudeConfig, { permissions: { deny: ['Bash(rm:*)'] } });
    await executeInstallPlan(await createPlan(dir, 'claude', 'init'));
    await executeInstallPlan(await createPlan(dir, 'opencode', 'init'));
    const survivingConfig = await fs.readFile(opencodeConfig, 'utf8');

    await runUninstallCommand({ dir, tool: 'claude', yes: true });
    expect((await fs.readJson(claudeConfig)).permissions).toEqual({ deny: ['Bash(rm:*)'] });
    expect((await fs.readJson(claudeConfig)).hooks).toBeUndefined();
    expect(await fs.readFile(opencodeConfig, 'utf8')).toBe(survivingConfig);
    const manifest = (await readManifest(dir))?.manifest;
    expect(manifest?.tools).toEqual(['opencode']);
    expect(manifest?.tool).toBe('opencode');
    expect(manifest?.managedAssets.some((asset) => asset.id === 'opencode-config-hooks')).toBe(
      true,
    );
    expect(manifest?.managedAssets.every((asset) => asset.tool !== 'claude')).toBe(true);
  });

  it('invalid JSON during uninstall leaves other Assets and the Manifest intact', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hook-uninstall-invalid-'));
    createdDirs.push(dir);
    await executeInstallPlan(await createPlan(dir, 'claude', 'init'));
    const configPath = path.join(dir, '.claude', 'settings.json');
    await fs.writeFile(configPath, '{ invalid');
    await expect(runUninstallCommand({ dir, yes: true })).rejects.toThrow(
      'Invalid hook configuration JSON',
    );
    expect(
      await fs.pathExists(
        path.join(
          dir,
          '.claude',
          'skills',
          'opsx-dev-pipeline',
          'scripts',
          'hooks',
          'block-dangerous-bash.mjs',
        ),
      ),
    ).toBe(true);
    expect(await readManifest(dir)).not.toBeNull();
    expect(await fs.readFile(configPath, 'utf8')).toBe('{ invalid');
  });

  it.each([
    false,
    true,
  ])('rejects invalid existing JSON during planning, including force=%s', async (force) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hook-invalid-'));
    createdDirs.push(dir);
    const configPath = path.join(dir, '.claude', 'settings.json');
    await fs.outputFile(configPath, '{ invalid');
    await expect(createPlan(dir, 'claude', 'init', force)).rejects.toThrow(
      'Invalid hook configuration JSON',
    );
    expect(await fs.readFile(configPath, 'utf8')).toBe('{ invalid');
    expect(await readManifest(dir)).toBeNull();
  });

  it('rejects invalidated JSON before writing any other Asset', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-hook-invalidated-'));
    createdDirs.push(dir);
    const configPath = path.join(dir, '.claude', 'settings.json');
    await fs.outputJson(configPath, {});
    const plan = await createPlan(dir, 'claude', 'init', true);
    await fs.writeFile(configPath, '{ invalid');
    await expect(executeInstallPlan(plan)).rejects.toThrow('Invalid hook configuration JSON');
    expect(await fs.pathExists(path.join(dir, '.claude', 'skills'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);
    expect(await fs.readFile(configPath, 'utf8')).toBe('{ invalid');
  });
});
