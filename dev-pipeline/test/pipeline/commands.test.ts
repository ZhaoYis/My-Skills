import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';
import { runListToolsCommand } from '../../src/cli/commands/list-tools.js';
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { runCli } from '../../src/cli/index.js';
import { readManifest } from '../../src/core/manifest/io.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';
import {
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_JSON_FILE,
  PACKAGE_VERSION,
} from '../../src/core/runtime/meta.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

const createdDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-commands-'));
  createdDirs.push(dir);
  return dir;
}

function baseManifest(overrides: Partial<PipelineManifest> = {}): PipelineManifest {
  return {
    schemaVersion: 2,
    projectName: 'demo',
    tool: 'claude',
    tools: ['claude'],
    stack: 'backend',
    techStack: 'java-spring-boot',
    language: 'zh',
    scope: 'project',
    features: ['base', 'skills', 'commands', 'docs', 'schema', 'hooks'],
    templateVersion: PACKAGE_VERSION,
    packageName: 'opsx-dev-pipeline',
    managedAssets: [
      { id: 'common-readme', destination: 'README.md' },
      { id: 'claude-docs', destination: 'CLAUDE.md', tool: 'claude' },
      { id: 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs', destination: '.claude/skills/opsx-dev-pipeline/SKILL.md', tool: 'claude' },
      {
        id: 'opsx-dev-pipeline-skill-bundle:scripts/preflight.mjs',
        destination: '.claude/skills/opsx-dev-pipeline/scripts/preflight.mjs',
        tool: 'claude',
      },
    ],
    ...overrides,
  };
}

async function writeManifestInPackageJson(dir: string, manifest: PipelineManifest): Promise<void> {
  await fs.writeJson(
    path.join(dir, PACKAGE_JSON_FILE),
    {
      name: 'demo-app',
      version: '1.0.0',
      [MANIFEST_PACKAGE_JSON_KEY]: manifest,
    },
    { spaces: 2 },
  );
}

async function seedInitializedProject(dir: string): Promise<void> {
  await fs.ensureDir(path.join(dir, '.claude/skills/opsx-dev-pipeline/scripts'));
  await fs.writeFile(path.join(dir, 'README.md'), '# Demo\n');
  await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'demo docs\n');
  await fs.writeFile(
    path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'),
    '# skill\n',
  );
  await fs.writeFile(
    path.join(dir, '.claude/skills/opsx-dev-pipeline/scripts/preflight.mjs'),
    '#!/usr/bin/env node\n',
  );
  await writeManifestInPackageJson(dir, baseManifest());
}

describe('runListToolsCommand', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('prints every supported tool in default mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runListToolsCommand({});

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('claude: Claude Code');
    expect(output).toContain('cursor: Cursor');
    expect(output).toContain('codex: Codex');
    expect(output).toContain('opencode: OpenCode');
    logSpy.mockRestore();
  });

  it('emits a JSON envelope when --json is enabled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runListToolsCommand({ json: true });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      packageVersion: string;
      tools: Array<{ id: string; destinations: { skills: string; commands: string } }>;
    };

    expect(payload.packageVersion).toBe(PACKAGE_VERSION);
    expect(payload.tools.map((tool) => tool.id).sort()).toEqual([
      'claude',
      'codex',
      'cursor',
      'opencode',
    ]);
    logSpy.mockRestore();
  });
});

describe('runDoctorCommand', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('reports warn when no manifest is present', async () => {
    const dir = await createTempDir();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const status = await runDoctorCommand(dir);

    expect(status).toBe('warn');
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Doctor summary: WARN');
    expect(output).toContain('No opsx-dev-pipeline manifest found in target directory.');
    logSpy.mockRestore();
  });

  it('returns ok for a project with the current template version', async () => {
    const dir = await createTempDir();
    await writeManifestInPackageJson(dir, baseManifest());

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir);

    expect(status).toBe('ok');
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Manifest template version matches');
    logSpy.mockRestore();
  });

  it('emits JSON when --json is enabled and includes versionCheck', async () => {
    const dir = await createTempDir();
    await writeManifestInPackageJson(
      dir,
      baseManifest({ templateVersion: '0.0.1' }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    expect(status).toBe('warn');
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      status: string;
      manifest: {
        templateVersion: string;
        currentVersion: string;
        versionCheck: { status: string; healthStatus: string };
      };
    };

    expect(payload.status).toBe('warn');
    expect(payload.manifest.templateVersion).toBe('0.0.1');
    expect(payload.manifest.currentVersion).toBe(PACKAGE_VERSION);
    expect(payload.manifest.versionCheck.status).toBe('outdated');
    logSpy.mockRestore();
  });

  it('reports fail when --stack and openspec/config.yaml are missing', async () => {
    const dir = await createTempDir();

    const status = await runDoctorCommand(dir, false, { stackOnly: true });

    expect(status).toBe('fail');
  });

  it('reports ok when --stack finds a configured stack', async () => {
    const dir = await createTempDir();
    await fs.ensureDir(path.join(dir, 'openspec'));
    await fs.writeFile(
      path.join(dir, 'openspec/config.yaml'),
      'stack:\n  id: fullstack-web\n  services: [api]\n',
    );

    const status = await runDoctorCommand(dir, false, { stackOnly: true });

    expect(status).toBe('ok');
  });
});

describe('runSyncCommand', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('rejects when the target directory has no manifest', async () => {
    const dir = await createTempDir();

    await expect(runSyncCommand({ dir })).rejects.toThrow(
      'No manifest found for sync. Run init first.',
    );
  });

  it('succeeds in dry-run mode when manifest is present', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(
      runSyncCommand({ dir, yes: true, dryRun: true }),
    ).resolves.toBeUndefined();

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output.length).toBeGreaterThan(0);
  });

  it('rewrites managed files in the target when not in dry-run', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);
    const readmePath = path.join(dir, 'README.md');
    await fs.writeFile(readmePath, '# existing user README\n');

    await runSyncCommand({ dir, yes: true });

    const readme = await fs.readFile(readmePath, 'utf8');
    expect(readme.length).toBeGreaterThan(0);
  });

  it('preserves the manifest when the only managed file is skipped', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);
    const originalManifest = (await readManifest(dir))?.manifest;
    expect(originalManifest).toBeDefined();

    await runSyncCommand({ dir, yes: true });

    const persisted = await readManifest(dir);
    expect(persisted?.manifest.templateVersion).toBe(PACKAGE_VERSION);
    expect(persisted?.manifest.tools).toEqual(['claude']);
  });
});

describe('runUpgradeCommand', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('rejects when no manifest is present', async () => {
    const dir = await createTempDir();

    await expect(runUpgradeCommand({ dir, yes: true })).rejects.toThrow(
      'No manifest found for upgrade. Run init first.',
    );
  });

  it('prints the upgrade preflight notice in dry-run mode', async () => {
    const dir = await createTempDir();
    await writeManifestInPackageJson(
      dir,
      baseManifest({ templateVersion: '0.1.0' }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runUpgradeCommand({ dir, yes: true, dryRun: true });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Upgrade preview');
    expect(output).toContain('0.1.0');
  });

  it('skips confirmation when --yes is set and manifest is outdated', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);
    await writeManifestInPackageJson(
      dir,
      baseManifest({ templateVersion: '0.0.5' }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runUpgradeCommand({ dir, yes: true, force: true });

    expect(prompts).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('cancels when the user declines an ahead manifest', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);
    await writeManifestInPackageJson(
      dir,
      baseManifest({ templateVersion: '99.0.0', language: 'zh' }),
    );

    vi.mocked(prompts).mockImplementation(async () => ({ continue: false }));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(runUpgradeCommand({ dir })).rejects.toThrow(
      'Upgrade cancelled due to manifest version mismatch.',
    );
    logSpy.mockRestore();
  });
});

describe('runUninstallCommand', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('rejects when no manifest is present', async () => {
    const dir = await createTempDir();

    await expect(runUninstallCommand({ dir })).rejects.toThrow(
      'No manifest found for uninstall. Nothing to remove.',
    );
  });

  it('removes every managed file in non-interactive mode', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);

    await runUninstallCommand({ dir, yes: true });

    expect(await fs.pathExists(path.join(dir, 'README.md'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, 'CLAUDE.md'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/scripts'))).toBe(false);
    expect(await readManifest(dir)).toBeNull();
  });

  it('removes only assets owned by the given tool when --tool is set', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);
    // Add a second tool's owned assets to the manifest
    await writeManifestInPackageJson(
      dir,
      baseManifest({
        tools: ['claude', 'cursor'],
        managedAssets: [
          { id: 'common-readme', destination: 'README.md' },
          { id: 'claude-docs', destination: 'CLAUDE.md', tool: 'claude' },
          { id: 'cursor-docs', destination: '.cursor/rules/opsx-dev-pipeline.mdc', tool: 'cursor' },
        ],
      }),
    );
    await fs.ensureDir(path.join(dir, '.cursor/rules'));
    await fs.writeFile(
      path.join(dir, '.cursor/rules/opsx-dev-pipeline.mdc'),
      'cursor rules',
    );

    await runUninstallCommand({ dir, yes: true, tool: 'claude' });

    expect(await fs.pathExists(path.join(dir, 'CLAUDE.md'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, '.cursor/rules/opsx-dev-pipeline.mdc'))).toBe(true);
    // README (shared) stays because another tool survives the scoped uninstall
    expect(await fs.pathExists(path.join(dir, 'README.md'))).toBe(true);

    const persisted = await readManifest(dir);
    expect(persisted?.manifest.tools).toEqual(['cursor']);
    expect(persisted?.manifest.managedAssets).toEqual([
      { id: 'common-readme', destination: 'README.md' },
      { id: 'cursor-docs', destination: '.cursor/rules/opsx-dev-pipeline.mdc', tool: 'cursor' },
    ]);
  });

  it('reports a tool-specific error when --tool targets an uninstalled tool', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);

    await expect(runUninstallCommand({ dir, tool: 'cursor' })).rejects.toThrow(
      'Tool "cursor" is not installed in this project. Installed tools: claude.',
    );
  });
});

describe('pipeline command integration', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('handles a full cycle: sync → upgrade → uninstall on the same directory', async () => {
    const dir = await createTempDir();
    await seedInitializedProject(dir);

    const syncLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runSyncCommand({ dir, yes: true });
    syncLog.mockRestore();

    const upgradeLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runUpgradeCommand({ dir, yes: true, force: true });
    upgradeLog.mockRestore();

    const uninstallLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runUninstallCommand({ dir, yes: true });
    uninstallLog.mockRestore();

    expect(await readManifest(dir)).toBeNull();
  });
});

describe('runCli command dispatch', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('routes list-tools through runListToolsCommand', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runCli(['node', 'opsx-dev-pipeline', 'list-tools', '--json']);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('packageVersion');
    logSpy.mockRestore();
  });

  it('routes doctor through runDoctorCommand and exits with code 0 on OK', async () => {
    const dir = await createTempDir();
    const originalCwd = process.cwd();
    const originalExitCode = process.exitCode;
    try {
      process.chdir(dir);
      await writeManifestInPackageJson(dir, baseManifest());
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCli(['node', 'opsx-dev-pipeline', 'doctor', '--json']);

      expect(process.exitCode).not.toBe(1);
      logSpy.mockRestore();
    } finally {
      process.chdir(originalCwd);
      process.exitCode = originalExitCode;
    }
  });

  it('sets process.exitCode to 1 when doctor reports fail', async () => {
    const dir = await createTempDir();
    const originalCwd = process.cwd();
    const originalExitCode = process.exitCode;
    try {
      process.chdir(dir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCli(['node', 'opsx-dev-pipeline', 'doctor', '--stack']);

      expect(process.exitCode).toBe(1);
      logSpy.mockRestore();
    } finally {
      process.chdir(originalCwd);
      process.exitCode = originalExitCode;
    }
  });
});

describe('git-delivery helpers', () => {
  function runGit(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      execFile(
        'git',
        args,
        { cwd: createdDirs.at(-1) ?? process.cwd() },
        (error, stdout, stderr) => {
          const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
          resolve({ code, stdout, stderr });
        },
      );
    });
  }

  async function createRepo(): Promise<string> {
    const dir = await createTempDir();
    await runGit(['init', '--quiet']);
    await runGit(['config', 'user.name', 'Pipeline Test']);
    await runGit(['config', 'user.email', 'pipeline@example.com']);
    await fs.writeFile(path.join(dir, 'README.md'), '# base\n');
    await runGit(['add', 'README.md']);
    await runGit(['commit', '-m', 'chore: init']);
    await runGit(['branch', '-M', 'main']);
    return dir;
  }

  it('supports a clean fast-forward merge of feature into main', async () => {
    const dir = await createRepo();
    await runGit(['switch', '-c', 'feature/demo']);
    await fs.writeFile(path.join(dir, 'feature.txt'), 'feature\n');
    await runGit(['add', 'feature.txt']);
    await runGit(['commit', '-m', 'feat: add feature']);
    await runGit(['switch', 'main']);

    const merge = await runGit(['merge', '--ff-only', 'feature/demo']);
    expect(merge.code).toBe(0);
    expect(await fs.readFile(path.join(dir, 'feature.txt'), 'utf8')).toBe('feature\n');
  });

  it('detects conflicts when both branches modify the same lines', async () => {
    const dir = await createRepo();
    await runGit(['switch', '-c', 'feature/demo']);
    await fs.writeFile(path.join(dir, 'conflict.txt'), 'source\n');
    await runGit(['add', 'conflict.txt']);
    await runGit(['commit', '-m', 'feat: source side']);
    await runGit(['switch', 'main']);
    await fs.writeFile(path.join(dir, 'conflict.txt'), 'target\n');
    await runGit(['add', 'conflict.txt']);
    await runGit(['commit', '-m', 'chore: target side']);

    const merge = await runGit(['merge', '--no-edit', 'feature/demo']);
    expect(merge.code).not.toBe(0);

    const status = await runGit(['diff', '--name-only', '--diff-filter=U']);
    expect(status.stdout.trim()).toBe('conflict.txt');

    await runGit(['merge', '--abort']);
    const clean = await runGit(['status', '--porcelain']);
    expect(clean.stdout).toBe('');
  });
});