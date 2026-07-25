import { beforeEach, describe, expect, it, vi } from 'vitest';
import prompts from 'prompts';
import type { ManifestVersionCheck } from '../../src/core/manifest/versionCheck.js';
import {
  ensureUpgradeVersionCheck,
  printUpgradeVersionNotice,
} from '../../src/core/upgrade/versionPrompt.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

function createVersionCheck(overrides: Partial<ManifestVersionCheck>): ManifestVersionCheck {
  return {
    status: 'current',
    healthStatus: 'ok',
    manifestVersion: '0.2.0',
    currentVersion: '0.2.0',
    message: 'Manifest template version matches the installed CLI (0.2.0).',
    ...overrides,
  };
}

describe('upgrade version prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prints a preflight notice', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    printUpgradeVersionNotice(createVersionCheck({ status: 'outdated', manifestVersion: '0.1.0' }));

    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Upgrade preflight');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('0.1.0');
    logSpy.mockRestore();
  });

  it('skips confirmation for outdated manifests when yes is enabled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await ensureUpgradeVersionCheck(
      createVersionCheck({ status: 'outdated', healthStatus: 'warn', manifestVersion: '0.1.0' }),
      { yes: true },
    );

    expect(prompts).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('asks for confirmation when manifest is ahead of the CLI', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({ continue: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await ensureUpgradeVersionCheck(
      createVersionCheck({
        status: 'ahead',
        healthStatus: 'warn',
        manifestVersion: '0.2.0',
        message: 'Manifest template version 0.2.0 is newer than the installed CLI 0.2.0.',
        recommendation:
          'Upgrade the opsx-dev-pipeline package to match the manifest template version.',
      }),
    );

    expect(prompts).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'continue', type: 'confirm' }),
      expect.objectContaining({ onCancel: expect.any(Function) }),
    );
    logSpy.mockRestore();
  });

  it('cancels upgrade when the user declines an ahead manifest', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({ continue: false });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      ensureUpgradeVersionCheck(
        createVersionCheck({
          status: 'ahead',
          healthStatus: 'warn',
          manifestVersion: '0.2.0',
          message: 'ahead',
        }),
      ),
    ).rejects.toThrow('Upgrade cancelled due to manifest version mismatch.');

    logSpy.mockRestore();
  });
});
