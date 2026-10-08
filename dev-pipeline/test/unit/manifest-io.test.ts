import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { inferAssetTool, readManifest, writeManifest } from '../../src/core/manifest/io.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';
import {
  LEGACY_MANIFEST_FILE,
  MANIFEST_FILE,
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_JSON_FILE,
} from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

const sampleManifest: PipelineManifest = {
  schemaVersion: 2,
  projectName: 'demo',
  tool: 'claude',
  tools: ['claude'],
  techStack: 'java-spring-boot',
  features: ['base'],
  templateVersion: '0.2.1',
  packageName: 'opsx-dev-pipeline',
  managedAssets: [{ id: 'common-readme', destination: 'README.md' }],
};

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('manifest io', () => {
  it('attributes Codex project and absolute user Skill destinations', () => {
    expect(inferAssetTool(path.join('.agents', 'skills', 'opsx-dev-pipeline', 'SKILL.md'))).toBe(
      'codex',
    );
    expect(
      inferAssetTool(path.join(os.homedir(), '.agents', 'skills', 'opsx-propose', 'SKILL.md')),
    ).toBe('codex');
    expect(
      inferAssetTool(
        path.win32.join('C:\\Users\\Test User', '.agents', 'skills', 'opsx-propose', 'SKILL.md'),
      ),
    ).toBe('codex');
    expect(
      inferAssetTool(path.join(os.homedir(), '.claude', 'skills', 'opsx-propose', 'SKILL.md')),
    ).toBe('claude');
    expect(inferAssetTool(path.join('openspec', 'specs', 'spec.md'))).toBeUndefined();
    expect(inferAssetTool(path.join('docs', '.agents', 'skills', 'example.md'))).toBeUndefined();
  });

  it('migrates untagged Codex Assets from an existing Manifest', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-codex-'));
    createdDirs.push(dir);
    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      ...sampleManifest,
      tools: ['codex', 'claude'],
      managedAssets: [
        {
          id: 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
          destination: path.join('.agents', 'skills', 'opsx-dev-pipeline', 'SKILL.md'),
        },
        {
          id: 'opsx-propose-command',
          destination: path.join(os.homedir(), '.agents', 'skills', 'opsx-propose', 'SKILL.md'),
        },
        { id: 'common-readme', destination: 'README.md' },
      ],
    });
    const manifest = (await readManifest(dir))?.manifest;
    expect(manifest?.managedAssets.map((asset) => asset.tool)).toEqual([
      'codex',
      'codex',
      undefined,
    ]);
  });

  it('does not keep an active Tool outside the installed tools array', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-active-'));
    createdDirs.push(dir);
    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      ...sampleManifest,
      tool: 'claude',
      tools: ['opencode'],
    });
    expect((await readManifest(dir))?.manifest.tool).toBe('opencode');
  });

  it('normalizes Windows separators in managed asset records', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await writeManifest(dir, {
      ...sampleManifest,
      managedAssets: [
        {
          id: 'backend-schema-bundle:templates\\api_design.md.hbs',
          destination: 'openspec\\schemas\\backend\\templates\\api_design.md',
        },
      ],
    });

    const raw = await fs.readJson(path.join(dir, MANIFEST_FILE));
    expect(raw.managedAssets).toEqual([
      {
        id: 'backend-schema-bundle:templates/api_design.md.hbs',
        destination: 'openspec/schemas/backend/templates/api_design.md',
      },
    ]);

    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      ...sampleManifest,
      managedAssets: [
        {
          id: 'backend-schema-bundle:templates\\design.md.hbs',
          destination: 'openspec\\schemas\\backend\\templates\\design.md',
        },
      ],
    });
    expect((await readManifest(dir))?.manifest.managedAssets).toEqual([
      {
        id: 'backend-schema-bundle:templates/design.md.hbs',
        destination: 'openspec/schemas/backend/templates/design.md',
      },
    ]);
  });

  it('writes and reads a standalone manifest file when package.json is absent', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await writeManifest(dir, sampleManifest);

    const result = await readManifest(dir);
    expect(result?.path).toBe(path.join(dir, MANIFEST_FILE));
    expect(result?.storage).toBe('standalone');
    expect(result?.manifest.tool).toBe('claude');
    expect(result?.manifest.techStack).toBe('java-spring-boot');
  });

  it('embeds manifest in package.json when package.json exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, PACKAGE_JSON_FILE), {
      name: 'demo-app',
      version: '1.0.0',
    });

    await writeManifest(dir, sampleManifest);

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);

    const pkg = await fs.readJson(path.join(dir, PACKAGE_JSON_FILE));
    expect(pkg.name).toBe('demo-app');
    expect(pkg[MANIFEST_PACKAGE_JSON_KEY].tool).toBe('claude');

    const result = await readManifest(dir);
    expect(result?.path).toBe(path.join(dir, PACKAGE_JSON_FILE));
    expect(result?.storage).toBe('package-json');
    expect(result?.manifest.tool).toBe('claude');
    expect(result?.manifest.techStack).toBe('java-spring-boot');
  });

  it('migrates standalone manifest into package.json and removes the standalone file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, MANIFEST_FILE), sampleManifest);
    await fs.writeJson(path.join(dir, PACKAGE_JSON_FILE), {
      name: 'demo-app',
      version: '1.0.0',
    });

    await writeManifest(dir, {
      ...sampleManifest,
      projectName: 'migrated-demo',
    });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);

    const result = await readManifest(dir);
    expect(result?.storage).toBe('package-json');
    expect(result?.manifest.projectName).toBe('migrated-demo');
  });

  it('reads the legacy manifest filename for compatibility', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, LEGACY_MANIFEST_FILE), {
      schemaVersion: 1,
      projectName: 'legacy-demo',
      tool: 'claude',
      features: ['base'],
      templateVersion: '0.1.0',
      packageName: 'opsx-dev-pipeline',
      managedAssets: [],
    });

    const result = await readManifest(dir);
    expect(result?.path).toBe(path.join(dir, LEGACY_MANIFEST_FILE));
    expect(result?.storage).toBe('standalone');
    expect(result?.manifest.projectName).toBe('legacy-demo');
    expect(result?.manifest.techStack).toBeUndefined();
  });

  it.each([
    'prototype',
    'opsx-pr',
    'opsx-ci-triage',
  ])('rejects manifests containing the removed %s feature', async (feature) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      ...sampleManifest,
      features: ['base', feature],
    });

    await expect(readManifest(dir)).rejects.toThrow();
  });

  it('prefers package.json embedded manifest over standalone files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-manifest-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      ...sampleManifest,
      projectName: 'standalone-demo',
    });
    await fs.writeJson(path.join(dir, PACKAGE_JSON_FILE), {
      name: 'demo-app',
      version: '1.0.0',
      [MANIFEST_PACKAGE_JSON_KEY]: {
        ...sampleManifest,
        projectName: 'embedded-demo',
      },
    });

    const result = await readManifest(dir);
    expect(result?.storage).toBe('package-json');
    expect(result?.manifest.projectName).toBe('embedded-demo');
  });
});
