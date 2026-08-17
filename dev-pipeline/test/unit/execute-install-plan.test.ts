import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import type { ToolAdapter } from '../../src/core/adapters/types.js';
import { executeInstallPlan } from '../../src/core/init/executeInstallPlan.js';
import type { InstallPlan } from '../../src/core/init/types.js';
import { readManifest } from '../../src/core/manifest/io.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

function createAdapter(): ToolAdapter {
  return {
    definition: {
      id: 'claude',
      displayName: 'Claude Code',
      description: 'Claude adapter',
      markers: ['.claude'],
      destinations: { root: '.', skills: '.claude/skills', commands: '.claude/commands' },
      supports: ['base', 'skills', 'commands', 'docs'],
    },
    detectFiles: () => ['.claude'],
    supports: () => true,
    getDestination: (feature: 'skills' | 'commands') =>
      feature === 'skills' ? '.claude/skills' : '.claude/commands',
    supportsUserDestination: () => true,
    getRoot: () => '.',
    getSkillRootNote: () => undefined,
  };
}

function createPlan(overrides: Partial<InstallPlan> = {}): InstallPlan {
  return {
    projectName: 'demo',
    tool: 'claude',
    language: 'zh',
    features: ['base', 'skills', 'commands', 'docs'],
    scope: 'project',
    adapter: createAdapter(),
    files: [],
    targetDir: '/tmp/unused',
    dryRun: false,
    force: false,
    mode: 'init',
    ...overrides,
  };
}

describe('executeInstallPlan', () => {
  it('persists the selected tech stack in the manifest', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-exec-tech-stack-'));
    createdDirs.push(dir);

    await executeInstallPlan(
      createPlan({
        targetDir: dir,
        stack: 'backend',
        techStack: 'java-spring-boot',
      }),
    );

    const manifest = await readManifest(dir);
    expect(manifest?.manifest.techStack).toBe('java-spring-boot');
  });

  it('preserves managed assets when sync skips existing conflicts', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-exec-sync-'));
    createdDirs.push(dir);

    const managedAssets = [
      { id: 'common-readme', destination: 'README.md' },
      { id: 'claude-docs', destination: 'CLAUDE.md' },
    ];

    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      schemaVersion: 1,
      projectName: 'demo',
      tool: 'claude',
      features: ['base', 'skills', 'commands', 'docs'],
      templateVersion: '0.2.1',
      packageName: 'opsx-dev-pipeline',
      managedAssets,
    });
    await fs.writeFile(path.join(dir, 'README.md'), '# Existing\n');
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    const plan = createPlan({
      targetDir: dir,
      mode: 'sync',
      files: [
        {
          assetId: 'common-readme',
          sourcePath: path.join(dir, 'README.md'),
          destinationPath: path.join(dir, 'README.md'),
          kind: 'template',
          exists: true,
          appendStrategy: 'simple',
          resolution: 'skip',
        },
        {
          assetId: 'claude-docs',
          sourcePath: path.join(dir, 'CLAUDE.md'),
          destinationPath: path.join(dir, 'CLAUDE.md'),
          kind: 'template',
          exists: true,
          appendStrategy: 'simple',
          resolution: 'skip',
        },
      ],
    });

    await executeInstallPlan(plan);

    const manifest = await readManifest(dir);
    expect(manifest?.manifest.managedAssets).toEqual(managedAssets);
  });

  it('tracks appended template files in managed assets during init', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-exec-append-'));
    createdDirs.push(dir);
    const readmePath = path.join(dir, 'README.md');
    const sourcePath = path.join(dir, 'README.template.md');

    await fs.writeFile(readmePath, '# Existing project\n');
    await fs.writeFile(sourcePath, '\n## Quick start\n');

    const plan = createPlan({
      targetDir: dir,
      mode: 'init',
      files: [
        {
          assetId: 'common-readme',
          sourcePath,
          destinationPath: readmePath,
          kind: 'template',
          exists: true,
          appendStrategy: 'simple',
          resolution: 'append',
        },
      ],
    });

    await executeInstallPlan(plan);

    const content = await fs.readFile(readmePath, 'utf8');
    expect(content).toContain('# Existing project');
    expect(content).toContain('## Quick start');

    const manifest = await readManifest(dir);
    expect(manifest?.manifest.managedAssets).toEqual([
      { id: 'common-readme', destination: 'README.md' },
    ]);
  });

  it('merges language settings into an existing OpenSpec config', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-exec-config-language-'));
    createdDirs.push(dir);
    const configPath = path.join(dir, 'openspec/project-settings.yaml');
    const sourcePath = path.join(dir, 'config.template.yaml');

    await fs.outputFile(
      configPath,
      'schema: frontend\ncontext: |\n  Existing context\n  Generated context\nrules:\n  proposal:\n    - "Keep this rule"\n',
    );
    await fs.writeFile(
      sourcePath,
      'language: en\nschema: frontend\ncontext: |\n  Generated context\nrules:\n  language:\n    - "All documents MUST be written in English"\n  proposal:\n    - "Generated rule"\n',
    );

    await executeInstallPlan(
      createPlan({
        targetDir: dir,
        language: 'en',
        mode: 'sync',
        files: [
          {
            assetId: 'stack-config',
            sourcePath,
            destinationPath: configPath,
            kind: 'template',
            exists: true,
            appendStrategy: 'config-merge',
            resolution: 'append',
          },
        ],
      }),
    );

    const content = await fs.readFile(configPath, 'utf8');
    expect(content).toContain('language: en');
    expect(content).toContain('All documents MUST be written in English');
    expect(content).toContain('Keep this rule');
    expect(content).not.toContain('Generated rule');
    expect(content.match(/Generated context/g)).toHaveLength(1);
    expect((await readManifest(dir))?.manifest.language).toBe('en');
  });
});
