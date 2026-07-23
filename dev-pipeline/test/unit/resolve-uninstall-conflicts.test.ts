import { beforeEach, describe, expect, it, vi } from 'vitest';
import prompts from 'prompts';
import { resolveUninstallConflicts } from '../../src/core/uninstall/resolveUninstallConflicts.js';
import type { UninstallPlan } from '../../src/core/uninstall/types.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

function createPlan(files?: Partial<UninstallPlan['files'][number]>[]): UninstallPlan {
  return {
    targetDir: '/tmp/demo',
    tool: 'claude',
    dryRun: false,
    keepKnowledge: false,
    manifestPath: '/tmp/demo/opsx-dev-pipeline.json',
    manifestStorage: 'standalone',
    files: (
      files ?? [
        {
          assetId: 'common-readme',
          destinationPath: '/tmp/demo/README.md',
          exists: true,
          appendable: true,
          resolution: 'unresolved',
        },
      ]
    ).map((file, index) => ({
      assetId: `asset-${index}`,
      destinationPath: `/tmp/demo/file-${index}.md`,
      exists: true,
      appendable: false,
      resolution: 'unresolved',
      ...file,
    })),
  };
}

describe('resolveUninstallConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-removes conflicts when yes is enabled', async () => {
    const plan = await resolveUninstallConflicts(createPlan(), { yes: true });
    expect(plan.files[0]?.resolution).toBe('remove');
  });

  it('applies skip-all from the prompt', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({ resolution: 'skip-all' });
    const plan = await resolveUninstallConflicts(
      createPlan([
        { destinationPath: '/tmp/demo/README.md', appendable: true },
        { destinationPath: '/tmp/demo/CLAUDE.md', appendable: true },
      ]),
      { yes: false },
    );

    expect(plan.files.every((file) => file.resolution === 'skip')).toBe(true);
  });
});
