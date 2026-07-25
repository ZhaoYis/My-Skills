import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildUninstallPlan } from '../../src/core/uninstall/buildUninstallPlan.js';
import type { ManifestReadResult } from '../../src/core/manifest/io.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-uninstall-plan-'));
  createdDirs.push(dir);
  return dir;
}

function createManifestResult(
  targetDir: string,
  managedAssets: ManifestReadResult['manifest']['managedAssets'],
): ManifestReadResult {
  return {
    path: path.join(targetDir, 'opsx-dev-pipeline.json'),
    storage: 'standalone',
    manifest: {
      schemaVersion: 1,
      projectName: 'demo',
      tool: 'claude',
      features: ['base', 'skills', 'commands', 'docs'],
      templateVersion: '0.2.0',
      packageName: 'opsx-dev-pipeline',
      managedAssets,
    },
  };
}

describe('buildUninstallPlan', () => {
  it('marks managed files for removal when yes is enabled', async () => {
    const targetDir = await createTempDir();
    await fs.writeFile(path.join(targetDir, 'README.md'), '# demo\n');
    await fs.ensureDir(path.join(targetDir, '.claude/skills/opsx-learn'));
    await fs.writeFile(path.join(targetDir, '.claude/skills/opsx-learn/SKILL.md'), '# learn\n');

    const plan = await buildUninstallPlan({
      targetDir,
      manifestResult: createManifestResult(targetDir, [
        { id: 'common-readme', destination: 'README.md' },
        {
          id: 'opsx-learn-skill-bundle:SKILL.md.hbs',
          destination: '.claude/skills/opsx-learn/SKILL.md',
        },
      ]),
      dryRun: false,
      yes: true,
    });

    expect(plan.files).toHaveLength(2);
    expect(plan.files.every((file) => file.resolution === 'remove')).toBe(true);
  });

  it('skips missing files and leaves unresolved files when yes is disabled', async () => {
    const targetDir = await createTempDir();
    await fs.writeFile(path.join(targetDir, 'README.md'), '# demo\n');

    const plan = await buildUninstallPlan({
      targetDir,
      manifestResult: createManifestResult(targetDir, [
        { id: 'common-readme', destination: 'README.md' },
        { id: 'opsx-learn-command', destination: '.claude/commands/opsx-learn.md' },
      ]),
      dryRun: false,
      yes: false,
    });

    expect(plan.files.find((file) => file.assetId === 'common-readme')?.resolution).toBe(
      'unresolved',
    );
    expect(plan.files.find((file) => file.assetId === 'opsx-learn-command')?.resolution).toBe(
      'skip',
    );
  });
});
