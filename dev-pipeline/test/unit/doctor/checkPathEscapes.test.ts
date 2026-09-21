import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPathEscapes } from '../../../src/core/doctor/checkPathEscapes.js';
import type { PipelineManifest } from '../../../src/core/manifest/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-check-path-escapes-'));
  createdDirs.push(dir);
  return dir;
}

function makeManifest(
  managedAssets: PipelineManifest['managedAssets'],
  scope?: PipelineManifest['scope'],
): PipelineManifest {
  return {
    schemaVersion: 2,
    projectName: 'demo',
    tools: ['claude'],
    features: ['base'],
    templateVersion: '0.0.0',
    packageName: 'opsx-dev-pipeline',
    scope,
    managedAssets,
  };
}

describe('checkPathEscapes', () => {
  it('skips user-scope assets whose destination is an absolute host path', async () => {
    const dir = await createTempDir();
    // Absolute destination under the user's home directory lives outside the
    // project on purpose — user-scope assets are explicitly skipped.
    const absoluteHome = path.resolve(os.homedir(), '.claude', 'settings.json');

    const manifest = makeManifest([{ id: 'user-claude', destination: absoluteHome }], 'user');

    const result = await checkPathEscapes(dir, manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns valid:true for project-scope assets that stay inside the project root', async () => {
    const dir = await createTempDir();
    const manifest = makeManifest([
      { id: 'common-readme', destination: 'README.md' },
      { id: 'claude-skill', destination: '.claude/skills/opsx-dev-pipeline/SKILL.md' },
    ]);

    const result = await checkPathEscapes(dir, manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags project-scope assets that escape the project root via ..', async () => {
    const dir = await createTempDir();
    const manifest = makeManifest([
      { id: 'common-readme', destination: 'README.md' },
      { id: 'evil-readme', destination: '../../../etc/passwd' },
      { id: 'sneaky', destination: 'subdir/../../escape.txt' },
    ]);

    const result = await checkPathEscapes(dir, manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({
      checkId: 'path-escapes',
      severity: 'error',
      path: 'managedAssets[evil-readme].destination',
      message: 'managed asset escapes project root: ../../../etc/passwd',
    });
    expect(result.issues[1]).toMatchObject({
      checkId: 'path-escapes',
      severity: 'error',
      path: 'managedAssets[sneaky].destination',
      message: 'managed asset escapes project root: subdir/../../escape.txt',
    });
  });

  it('also flags user-scope assets with relative destinations that escape', async () => {
    const dir = await createTempDir();
    // User-scope + absolute = skip; user-scope + relative is still subject to
    // the escape check.
    const manifest = makeManifest(
      [{ id: 'evil-user-rel', destination: '../leak.txt' }],
      'user',
    );

    const result = await checkPathEscapes(dir, manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      checkId: 'path-escapes',
      severity: 'error',
      path: 'managedAssets[evil-user-rel].destination',
      message: 'managed asset escapes project root: ../leak.txt',
    });
  });
});
