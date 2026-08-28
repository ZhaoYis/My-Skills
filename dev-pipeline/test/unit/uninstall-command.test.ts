import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import type { FeatureId, ToolId } from '../../src/core/adapters/types.js';
import { buildUninstallPlan } from '../../src/core/uninstall/buildUninstallPlan.js';
import { executeUninstallPlan } from '../../src/core/uninstall/executeUninstallPlan.js';
import { resolveUninstallConflicts } from '../../src/core/uninstall/resolveUninstallConflicts.js';
import type { UninstallPlan } from '../../src/core/uninstall/types.js';
import { readManifest } from '../../src/core/manifest/io.js';

vi.mock('../../src/core/manifest/io.js', () => ({
  readManifest: vi.fn(),
}));

vi.mock('../../src/core/uninstall/buildUninstallPlan.js', () => ({
  buildUninstallPlan: vi.fn(),
}));

vi.mock('../../src/core/uninstall/executeUninstallPlan.js', () => ({
  executeUninstallPlan: vi.fn(),
}));

vi.mock('../../src/core/uninstall/resolveUninstallConflicts.js', () => ({
  resolveUninstallConflicts: vi.fn(),
}));

const readManifestMock = vi.mocked(readManifest);
const buildUninstallPlanMock = vi.mocked(buildUninstallPlan);
const executeUninstallPlanMock = vi.mocked(executeUninstallPlan);
const resolveUninstallConflictsMock = vi.mocked(resolveUninstallConflicts);

const createdDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-uninstall-command-'));
  createdDirs.push(dir);
  return dir;
}

function createManifestResult(targetDir: string, tools: ToolId[]) {
  return {
    path: path.join(targetDir, 'opsx-dev-pipeline.json'),
    storage: 'standalone' as const,
    manifest: {
      schemaVersion: 2,
      projectName: 'demo',
      tool: tools[0],
      tools,
      features: ['base'] satisfies FeatureId[],
      templateVersion: '0.2.1',
      packageName: 'opsx-dev-pipeline',
      managedAssets: [],
    },
  };
}

function createPlan(files: UninstallPlan['files'] = []): UninstallPlan {
  return {
    targetDir: '/tmp/demo',
    tool: undefined,
    dryRun: false,
    manifestPath: '/tmp/demo/opsx-dev-pipeline.json',
    manifestStorage: 'standalone',
    files,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('runUninstallCommand', () => {
  it('throws when the target directory has no manifest', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(null);

    await expect(runUninstallCommand({ dir })).rejects.toThrow(
      'No manifest found for uninstall. Nothing to remove.',
    );
    expect(buildUninstallPlanMock).not.toHaveBeenCalled();
    expect(executeUninstallPlanMock).not.toHaveBeenCalled();
  });

  it('throws when --tool targets a tool that is not installed', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(createManifestResult(dir, ['claude']));

    await expect(runUninstallCommand({ dir, tool: 'cursor' })).rejects.toThrow(
      'Tool "cursor" is not installed in this project. Installed tools: claude.',
    );
    expect(buildUninstallPlanMock).not.toHaveBeenCalled();
  });

  it('lists installed tools as (none recorded) when manifest has no tools', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(createManifestResult(dir, []));

    await expect(runUninstallCommand({ dir, tool: 'claude' })).rejects.toThrow(
      'Tool "claude" is not installed in this project. Installed tools: (none recorded).',
    );
  });

  it('throws when the resolved plan contains no managed files', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(createManifestResult(dir, ['claude']));
    buildUninstallPlanMock.mockResolvedValue(createPlan([]));

    await expect(runUninstallCommand({ dir })).rejects.toThrow(
      'No managed files matched the uninstall plan.',
    );
    expect(resolveUninstallConflictsMock).not.toHaveBeenCalled();
    expect(executeUninstallPlanMock).not.toHaveBeenCalled();
  });

  it('uses a tool-specific error message when --tool is provided and plan is empty', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(createManifestResult(dir, ['claude']));
    buildUninstallPlanMock.mockResolvedValue(createPlan([]));

    await expect(runUninstallCommand({ dir, tool: 'claude' })).rejects.toThrow(
      'No managed files matched tool "claude".',
    );
  });

  it('threads yes and dryRun flags into the build call', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(createManifestResult(dir, ['claude']));
    const plan = createPlan([
      {
        assetId: 'common-readme',
        destinationPath: path.join(dir, 'README.md'),
        exists: true,
        appendable: false,
        resolution: 'unresolved',
      },
    ]);
    buildUninstallPlanMock.mockResolvedValue(plan);
    resolveUninstallConflictsMock.mockResolvedValue(plan);
    executeUninstallPlanMock.mockResolvedValue(undefined);

    await runUninstallCommand({ dir, yes: true, dryRun: true });

    expect(buildUninstallPlanMock).toHaveBeenCalledWith({
      targetDir: dir,
      manifestResult: expect.objectContaining({ storage: 'standalone' }),
      dryRun: true,
      yes: true,
      tool: undefined,
    });
    expect(resolveUninstallConflictsMock).toHaveBeenCalledWith(plan, { yes: true });
    expect(executeUninstallPlanMock).toHaveBeenCalledWith(plan);
  });

  it('passes --tool through to the build call when set', async () => {
    const dir = await createTempDir();
    readManifestMock.mockResolvedValue(createManifestResult(dir, ['claude', 'cursor']));
    const plan = createPlan([
      {
        assetId: 'claude-docs',
        destinationPath: path.join(dir, 'CLAUDE.md'),
        exists: true,
        appendable: false,
        resolution: 'unresolved',
      },
    ]);
    plan.tool = 'claude';
    buildUninstallPlanMock.mockResolvedValue(plan);
    resolveUninstallConflictsMock.mockResolvedValue(plan);
    executeUninstallPlanMock.mockResolvedValue(undefined);

    await runUninstallCommand({ dir, tool: 'claude' });

    expect(buildUninstallPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'claude', yes: false, dryRun: false }),
    );
  });

  it('uses process.cwd() when --dir is omitted', async () => {
    const originalCwd = process.cwd();
    const dir = await createTempDir();
    try {
      process.chdir(dir);
      readManifestMock.mockResolvedValue(createManifestResult(dir, ['claude']));
      buildUninstallPlanMock.mockResolvedValue(
        createPlan([
          {
            assetId: 'common-readme',
            destinationPath: path.join(dir, 'README.md'),
            exists: true,
            appendable: false,
            resolution: 'unresolved',
          },
        ]),
      );
      resolveUninstallConflictsMock.mockImplementation(async (input) => input);
      executeUninstallPlanMock.mockResolvedValue(undefined);

      await runUninstallCommand({});

      const resolvedDir = (readManifestMock.mock.calls[0]?.[0] ?? '') as string;
      const [expected, actual] = await Promise.all([fs.realpath(dir), fs.realpath(resolvedDir)]);
      expect(actual).toBe(expected);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
