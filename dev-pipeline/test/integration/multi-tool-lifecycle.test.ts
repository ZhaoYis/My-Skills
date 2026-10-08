import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import { loadToolRegistry } from '../../src/core/adapters/registry.js';
import type { ToolId } from '../../src/core/adapters/types.js';
import { buildInstallPlan } from '../../src/core/init/buildInstallPlan.js';
import { executeInstallPlan } from '../../src/core/init/executeInstallPlan.js';
import { resolveInstallConflicts } from '../../src/core/init/resolveInstallConflicts.js';
import { readManifest } from '../../src/core/manifest/io.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const createdDirs: string[] = [];
afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function installSkills(targetDir: string, tool: ToolId) {
  const plan = await buildInstallPlan({
    rootDir: PACKAGE_ROOT,
    targetDir,
    projectName: 'demo',
    tool,
    stack: 'backend',
    features: ['skills'],
    scope: 'project',
    dryRun: false,
    force: false,
    mode: 'init',
    registry: await loadToolRegistry(PACKAGE_ROOT),
  });
  await executeInstallPlan(await resolveInstallConflicts(plan, { yes: true, force: false }));
}

describe('multi Tool lifecycle', () => {
  it('removes Codex Skills independently and never reinstalls the removed active Tool on Sync', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-lifecycle-'));
    createdDirs.push(dir);
    await installSkills(dir, 'claude');
    await installSkills(dir, 'codex');
    const before = (await readManifest(dir))?.manifest;
    expect(before?.tool).toBe('codex');
    const codexAssets = before?.managedAssets.filter((asset) =>
      asset.destination.startsWith('.agents/'),
    );
    expect(codexAssets?.length).toBeGreaterThan(0);
    expect(codexAssets?.every((asset) => asset.tool === 'codex')).toBe(true);

    await runUninstallCommand({ dir, tool: 'codex', yes: true });
    expect(
      await fs.pathExists(path.join(dir, '.agents', 'skills', 'opsx-dev-pipeline', 'SKILL.md')),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(dir, '.claude', 'skills', 'opsx-dev-pipeline', 'SKILL.md')),
    ).toBe(true);
    const after = (await readManifest(dir))?.manifest;
    expect(after?.tools).toEqual(['claude']);
    expect(after?.tool).toBe('claude');
    expect(after?.managedAssets.every((asset) => asset.tool !== 'codex')).toBe(true);

    await runSyncCommand({ dir, yes: true });
    expect((await readManifest(dir))?.manifest.tools).toEqual(['claude']);
    expect(
      await fs.pathExists(path.join(dir, '.agents', 'skills', 'opsx-dev-pipeline', 'SKILL.md')),
    ).toBe(false);
  });
});
