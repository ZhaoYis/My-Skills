import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
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

  it('emits assets, pathEscapes and toolConfig sections in JSON output', async () => {
    const dir = await createTempDir();
    // README.md is rendered to disk so the `assets` section is clean.
    await fs.writeFile(path.join(dir, 'README.md'), 'hello');

    await fs.writeJson(
      path.join(dir, MANIFEST_FILE),
      {
        schemaVersion: 2,
        projectName: 'demo',
        tool: 'claude',
        tools: ['claude'],
        features: ['base'],
        templateVersion: PACKAGE_VERSION,
        packageName: 'opsx-dev-pipeline',
        managedAssets: [
          { id: 'common-readme', destination: 'README.md' },
          { id: 'evil', destination: '../escape.txt' },
        ],
      },
      { spaces: 2 },
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    // The malicious asset triggers two checks: it's missing (assets) AND it
    // escapes the project root (pathEscapes). Either is enough to fail overall.
    expect(status).toBe('fail');
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      assets: { valid: boolean; issues: Array<{ message: string; checkId?: string }> };
      pathEscapes: { valid: boolean; issues: Array<{ message: string; checkId?: string }> };
      toolConfig: { valid: boolean; issues: Array<{ message: string; checkId?: string }> };
    };

    expect(payload.assets.valid).toBe(false);
    expect(payload.assets.issues.some((i) => i.message === 'managed asset missing: ../escape.txt'))
      .toBe(true);

    expect(payload.pathEscapes.valid).toBe(false);
    expect(
      payload.pathEscapes.issues.some((i) =>
        i.message.startsWith('managed asset escapes project root:'),
      ),
    ).toBe(true);

    expect(payload.toolConfig.valid).toBe(true);
    expect(payload.toolConfig.issues).toEqual([]);
  });

  it('reports managed asset drift in the assets section', async () => {
    const dir = await createTempDir();
    await fs.writeJson(
      path.join(dir, MANIFEST_FILE),
      {
        schemaVersion: 2,
        projectName: 'demo',
        tool: 'claude',
        tools: ['claude'],
        features: ['base'],
        templateVersion: PACKAGE_VERSION,
        packageName: 'opsx-dev-pipeline',
        managedAssets: [{ id: 'ghost', destination: 'never-created.md' }],
      },
      { spaces: 2 },
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    expect(status).toBe('fail');
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      assets: { valid: boolean; issues: Array<{ message: string; checkId?: string }> };
    };

    expect(payload.assets.valid).toBe(false);
    expect(payload.assets.issues[0]).toMatchObject({
      checkId: 'managed-assets',
      severity: 'error',
      message: 'managed asset missing: never-created.md',
    });
  });

  it('falls back to empty ok sections when no manifest exists', async () => {
    const dir = await createTempDir();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    expect(status).toBe('warn');
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      assets: { valid: boolean; issues: unknown[] };
      pathEscapes: { valid: boolean; issues: unknown[] };
      toolConfig: { valid: boolean; issues: unknown[] };
      manifest: { path: string | null; message: string };
    };

    expect(payload.assets).toEqual({ valid: true, issues: [] });
    expect(payload.pathEscapes).toEqual({ valid: true, issues: [] });
    expect(payload.toolConfig).toEqual({ valid: true, issues: [] });
    expect(payload.manifest.path).toBeNull();
    expect(payload.manifest.message).toMatch(/manifest/i);
  });
});
