import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LEGACY_MANIFEST_FILE, MANIFEST_FILE } from '../../src/core/runtime/meta.js';
import { readManifest, writeManifest } from '../../src/core/manifest/io.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('manifest io', () => {
  it('writes and reads the current manifest file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await writeManifest(dir, {
      schemaVersion: 1,
      projectName: 'demo',
      tool: 'claude',
      features: ['base'],
      templateVersion: '0.1.0',
      packageName: 'opsx-dev-pipeline',
      managedAssets: [{ id: 'common-readme', destination: 'README.md' }]
    });

    const result = await readManifest(dir);
    expect(result?.path).toBe(path.join(dir, MANIFEST_FILE));
    expect(result?.manifest.tool).toBe('claude');
  });

  it('reads the legacy manifest filename for compatibility', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, LEGACY_MANIFEST_FILE), {
      schemaVersion: 1,
      projectName: 'legacy-demo',
      tool: 'generic',
      features: ['base'],
      templateVersion: '0.1.0',
      packageName: 'opsx-dev-pipeline',
      managedAssets: []
    });

    const result = await readManifest(dir);
    expect(result?.path).toBe(path.join(dir, LEGACY_MANIFEST_FILE));
    expect(result?.manifest.projectName).toBe('legacy-demo');
  });
});
