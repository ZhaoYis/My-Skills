import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';
import { MANIFEST_FILE, PACKAGE_VERSION } from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-doctor-command-'));
  createdDirs.push(dir);
  return dir;
}

describe('runDoctorCommand', () => {
  it('includes versionCheck in JSON output and warns on outdated manifest', async () => {
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
        managedAssets: [],
      },
      { spaces: 2 },
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    expect(status).toBe('warn');
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      manifest: {
        templateVersion: string;
        currentVersion: string;
        versionCheck: { status: string; healthStatus: string };
      };
    };

    expect(payload.manifest.templateVersion).toBe('0.1.0');
    expect(payload.manifest.currentVersion).toBe(PACKAGE_VERSION);
    expect(payload.manifest.versionCheck.status).toBe('outdated');
    expect(payload.manifest.versionCheck.healthStatus).toBe('warn');
  });
});
