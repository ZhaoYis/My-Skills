import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { checkManagedAssets } from '../../../src/core/doctor/checkManagedAssets.js';
import type { ManagedAssetHealthResult } from '../../../src/core/doctor/types.js';
import type { PipelineManifest } from '../../../src/core/manifest/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-check-managed-assets-'));
  createdDirs.push(dir);
  return dir;
}

function makeManifest(managedAssets: PipelineManifest['managedAssets']): PipelineManifest {
  return {
    schemaVersion: 2,
    projectName: 'demo',
    tools: ['claude'],
    features: ['base'],
    templateVersion: '0.0.0',
    packageName: 'opsx-dev-pipeline',
    managedAssets,
  };
}

async function runCheckSafely(
  dir: string,
  manifest: PipelineManifest,
): Promise<ManagedAssetHealthResult> {
  try {
    return await checkManagedAssets(dir, manifest);
  } finally {
    // Restore permissions so the afterEach cleanup can delete the directory.
    const target = path.join(dir, 'secrets.md');
    const parent = path.dirname(target);
    await fs.chmod(target, 0o600).catch(() => undefined);
    await fs.chmod(parent, 0o700).catch(() => undefined);
  }
}

describe('checkManagedAssets', () => {
  it('returns valid:true when every declared asset exists and is readable', async () => {
    const dir = await createTempDir();
    await fs.writeFile(path.join(dir, 'README.md'), 'hello');
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'agent hints');

    const manifest = makeManifest([
      { id: 'common-readme', destination: 'README.md' },
      { id: 'claude-docs', destination: 'CLAUDE.md' },
    ]);

    const result = await checkManagedAssets(dir, manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('emits an error for each missing managed asset', async () => {
    const dir = await createTempDir();
    await fs.writeFile(path.join(dir, 'README.md'), 'hello');

    const manifest = makeManifest([
      { id: 'common-readme', destination: 'README.md' },
      { id: 'common-gitignore', destination: '.gitignore' },
      { id: 'claude-docs', destination: 'CLAUDE.md' },
    ]);

    const result = await checkManagedAssets(dir, manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({
      checkId: 'managed-assets',
      severity: 'error',
      path: 'managedAssets[common-gitignore].destination',
      message: 'managed asset missing: .gitignore',
    });
    expect(result.issues[1]).toMatchObject({
      checkId: 'managed-assets',
      severity: 'error',
      path: 'managedAssets[claude-docs].destination',
      message: 'managed asset missing: CLAUDE.md',
    });
  });

  it('emits an error when an asset exists but cannot be read', async () => {
    const dir = await createTempDir();
    const target = path.join(dir, 'secrets.md');
    await fs.writeFile(target, 'shh');

    if (process.platform === 'win32') {
      // chmod is a no-op on Windows; simulate unreadable state by removing the
      // file outright so the check surfaces drift via "missing" instead.
      await fs.remove(target);
    } else {
      await fs.chmod(target, 0o000);
    }

    const manifest = makeManifest([{ id: 'shh', destination: 'secrets.md' }]);

    const result = await runCheckSafely(dir, manifest);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    const errorMessages = result.issues.map((i) => i.message);
    if (process.platform === 'win32') {
      // Windows fallback: file was deleted, so we get "missing".
      expect(errorMessages[0]).toBe('managed asset missing: secrets.md');
    } else {
      expect(errorMessages[0]).toBe('managed asset unreadable: secrets.md');
    }
    expect(result.issues[0]).toMatchObject({
      checkId: 'managed-assets',
      severity: 'error',
      path: 'managedAssets[shh].destination',
    });
  });
});
