import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeUninstallPlan } from '../../src/core/uninstall/executeUninstallPlan.js';
import type { UninstallPlan } from '../../src/core/uninstall/types.js';
import { MANIFEST_FILE, MANIFEST_PACKAGE_JSON_KEY } from '../../src/core/runtime/meta.js';
import { readManifest } from '../../src/core/manifest/io.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-uninstall-exec-'));
  createdDirs.push(dir);
  return dir;
}

function createPlan(targetDir: string, overrides?: Partial<UninstallPlan>): UninstallPlan {
  return {
    targetDir,
    tool: 'claude',
    dryRun: false,
    keepKnowledge: false,
    manifestPath: path.join(targetDir, MANIFEST_FILE),
    manifestStorage: 'standalone',
    files: [],
    ...overrides,
  };
}

describe('executeUninstallPlan', () => {
  it('removes managed files, empty skill directories, and manifest', async () => {
    const targetDir = await createTempDir();
    const skillDir = path.join(targetDir, '.claude/skills/opsx-learn');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# learn\n');
    await fs.writeFile(path.join(targetDir, 'README.md'), '# demo\n');
    await fs.writeJson(
      path.join(targetDir, MANIFEST_FILE),
      {
        schemaVersion: 1,
        projectName: 'demo',
        tool: 'claude',
        features: ['base'],
        templateVersion: '0.1.5',
        packageName: 'opsx-dev-pipeline',
        managedAssets: [
          { id: 'common-readme', destination: 'README.md' },
          {
            id: 'opsx-learn-skill-bundle:SKILL.md.hbs',
            destination: '.claude/skills/opsx-learn/SKILL.md',
          },
        ],
      },
      { spaces: 2 },
    );

    await executeUninstallPlan(
      createPlan(targetDir, {
        files: [
          {
            assetId: 'common-readme',
            destinationPath: path.join(targetDir, 'README.md'),
            exists: true,
            appendable: true,
            resolution: 'remove',
          },
          {
            assetId: 'opsx-learn-skill-bundle:SKILL.md.hbs',
            destinationPath: path.join(skillDir, 'SKILL.md'),
            exists: true,
            appendable: true,
            resolution: 'remove',
          },
        ],
      }),
    );

    expect(await fs.pathExists(path.join(targetDir, 'README.md'))).toBe(false);
    expect(await fs.pathExists(path.join(skillDir, 'SKILL.md'))).toBe(false);
    expect(await fs.pathExists(skillDir)).toBe(false);
    expect(await readManifest(targetDir)).toBeNull();
  });

  it('removes embedded manifest from package.json', async () => {
    const targetDir = await createTempDir();
    await fs.writeFile(path.join(targetDir, 'README.md'), '# demo\n');
    await fs.writeJson(
      path.join(targetDir, 'package.json'),
      {
        name: 'demo-app',
        version: '1.0.0',
        [MANIFEST_PACKAGE_JSON_KEY]: {
          schemaVersion: 1,
          projectName: 'demo-app',
          tool: 'claude',
          features: ['base'],
          templateVersion: '0.1.5',
          packageName: 'opsx-dev-pipeline',
          managedAssets: [{ id: 'common-readme', destination: 'README.md' }],
        },
      },
      { spaces: 2 },
    );

    await executeUninstallPlan(
      createPlan(targetDir, {
        manifestPath: path.join(targetDir, 'package.json'),
        manifestStorage: 'package-json',
        files: [
          {
            assetId: 'common-readme',
            destinationPath: path.join(targetDir, 'README.md'),
            exists: true,
            appendable: true,
            resolution: 'remove',
          },
        ],
      }),
    );

    const pkg = (await fs.readJson(path.join(targetDir, 'package.json'))) as Record<
      string,
      unknown
    >;
    expect(pkg[MANIFEST_PACKAGE_JSON_KEY]).toBeUndefined();
    expect(await readManifest(targetDir)).toBeNull();
  });

  it('updates manifest when keepKnowledge leaves managed knowledge assets', async () => {
    const targetDir = await createTempDir();
    await fs.ensureDir(path.join(targetDir, '.knowledge'));
    await fs.writeFile(path.join(targetDir, '.knowledge/README.md'), '# knowledge\n');
    await fs.writeFile(path.join(targetDir, 'README.md'), '# demo\n');
    await fs.writeJson(
      path.join(targetDir, MANIFEST_FILE),
      {
        schemaVersion: 1,
        projectName: 'demo',
        tool: 'claude',
        features: ['base'],
        templateVersion: '0.1.5',
        packageName: 'opsx-dev-pipeline',
        managedAssets: [
          { id: 'common-readme', destination: 'README.md' },
          { id: 'common-knowledge-skeleton:README.md.hbs', destination: '.knowledge/README.md' },
        ],
      },
      { spaces: 2 },
    );

    await executeUninstallPlan(
      createPlan(targetDir, {
        keepKnowledge: true,
        files: [
          {
            assetId: 'common-readme',
            destinationPath: path.join(targetDir, 'README.md'),
            exists: true,
            appendable: true,
            resolution: 'remove',
          },
        ],
      }),
    );

    const manifest = await readManifest(targetDir);
    expect(manifest?.manifest.managedAssets).toEqual([
      { id: 'common-knowledge-skeleton:README.md.hbs', destination: '.knowledge/README.md' },
    ]);
    expect(await fs.pathExists(path.join(targetDir, '.knowledge/README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'README.md'))).toBe(false);
  });

  it('does not write files during dry run', async () => {
    const targetDir = await createTempDir();
    await fs.writeFile(path.join(targetDir, 'README.md'), '# demo\n');
    await fs.writeJson(
      path.join(targetDir, MANIFEST_FILE),
      {
        schemaVersion: 1,
        projectName: 'demo',
        tool: 'claude',
        features: ['base'],
        templateVersion: '0.1.5',
        packageName: 'opsx-dev-pipeline',
        managedAssets: [{ id: 'common-readme', destination: 'README.md' }],
      },
      { spaces: 2 },
    );

    await executeUninstallPlan(
      createPlan(targetDir, {
        dryRun: true,
        files: [
          {
            assetId: 'common-readme',
            destinationPath: path.join(targetDir, 'README.md'),
            exists: true,
            appendable: true,
            resolution: 'remove',
          },
        ],
      }),
    );

    expect(await fs.pathExists(path.join(targetDir, 'README.md'))).toBe(true);
    expect(await readManifest(targetDir)).not.toBeNull();
  });
});
