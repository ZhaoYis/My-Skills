import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
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

  it('detects and recalculates existing fingerprints after upgrade', async () => {
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

    const stateFile = path.join(dir, 'openspec/.pipeline-state/existing-change.json');
    await fs.outputJson(
      stateFile,
      {
        schemaVersion: 2,
        changeName: 'existing-change',
        createdAt: '2026-07-28 00:00:00',
        createdBy: 'Upgrade Tester',
        createdByEmail: 'upgrade@example.com',
        machineInfo: {
          platform: 'darwin',
          hostname: 'upgrade-host',
          osRelease: '25.0.0',
          nodeVersion: 'v24.0.0',
          arch: 'arm64',
        },
        featureInfo: { featureId: 'REQ-UPGRADE-001', featureUrl: null },
        fingerprintId: 'legacy-fingerprint',
        fingerprintNonce: '1234abcd',
      },
      { spaces: 2 },
    );
    const compliantStateFile = path.join(dir, 'openspec/.pipeline-state/compliant-change.json');
    const compliantFingerprintId = `fp1.${'A'.repeat(342)}`;
    await fs.outputJson(
      compliantStateFile,
      {
        schemaVersion: 2,
        changeName: 'compliant-change',
        createdAt: '2026-07-28 00:00:00',
        createdBy: 'Upgrade Tester',
        createdByEmail: 'upgrade@example.com',
        machineInfo: {
          platform: 'darwin',
          hostname: 'upgrade-host',
          osRelease: '25.0.0',
          nodeVersion: 'v24.0.0',
          arch: 'arm64',
        },
        featureInfo: { featureId: 'REQ-UPGRADE-002', featureUrl: null },
        fingerprintId: compliantFingerprintId,
        fingerprintNonce: '5678efab',
      },
      { spaces: 2 },
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runUpgradeCommand({ dir, yes: true, force: true, dryRun: false });

    const refreshedState = await fs.readJson(stateFile);
    expect(refreshedState.fingerprintId).toMatch(/^fp1\.[A-Za-z0-9_-]{342}$/);
    expect(refreshedState.fingerprintId).not.toBe('legacy-fingerprint');
    expect((await fs.readJson(compliantStateFile)).fingerprintId).toBe(compliantFingerprintId);
    const messages = logSpy.mock.calls.map((call) => String(call[0]));
    expect(
      messages.some((message) => message.includes('detected 2; 1 compliant; 1 refreshed')),
    ).toBe(true);
  });
});
