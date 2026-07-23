import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-upgrade-command-'));
  createdDirs.push(dir);
  return dir;
}

describe('runUpgradeCommand', () => {
  it('prints a version preflight notice before dry-run upgrade', async () => {
    const dir = await createTempDir();
    await fs.writeJson(
      path.join(dir, MANIFEST_FILE),
      {
        schemaVersion: 1,
        projectName: 'demo',
        tool: 'claude',
        features: ['base'],
        templateVersion: '0.1.0',
        packageName: 'opsx-dev-pipeline',
        managedAssets: [{ id: 'common-readme', destination: 'README.md' }],
      },
      { spaces: 2 },
    );
    await fs.writeFile(path.join(dir, 'README.md'), '# demo\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runUpgradeCommand({ dir, yes: true, dryRun: true });

    const messages = logSpy.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('Upgrade preview'))).toBe(true);
    expect(messages.some((message) => message.includes('0.1.0'))).toBe(true);
  });
});
