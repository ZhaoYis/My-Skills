import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-command-'));
  createdDirs.push(dir);
  return dir;
}

describe('runSyncCommand', () => {
  it('throws when no manifest exists in the target directory', async () => {
    const dir = await createTempDir();

    await expect(runSyncCommand({ dir, yes: true })).rejects.toThrow(
      'No manifest found for sync. Run init first.',
    );
  });

  it('runs successfully in dry-run mode when manifest exists', async () => {
    const dir = await createTempDir();
    await fs.writeJson(
      path.join(dir, MANIFEST_FILE),
      {
        schemaVersion: 1,
        projectName: 'test-sync',
        tool: 'claude',
        stack: 'frontend',
        features: ['base'],
        managedAssets: [{ id: 'common-readme', destination: 'README.md' }],
      },
      { spaces: 2 },
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    // Should not throw when manifest exists and dryRun is true
    await expect(runSyncCommand({ dir, yes: true, dryRun: true })).resolves.toBeUndefined();

    // Console output was produced during the dry-run
    const messages = logSpy.mock.calls.map((call) => String(call[0]));
    expect(messages.length).toBeGreaterThan(0);
  });

  it('runs successfully in dry-run mode with force flag', async () => {
    const dir = await createTempDir();
    await fs.writeJson(
      path.join(dir, MANIFEST_FILE),
      {
        schemaVersion: 1,
        projectName: 'test-sync-force',
        tool: 'cursor',
        stack: 'backend',
        features: ['base', 'commands'],
        managedAssets: [],
      },
      { spaces: 2 },
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      runSyncCommand({ dir, yes: true, dryRun: true, force: true }),
    ).resolves.toBeUndefined();

    expect(logSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
