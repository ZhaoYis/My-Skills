import { beforeEach, describe, expect, it, vi } from 'vitest';
import prompts from 'prompts';
import { resolveInstallConflicts } from '../../src/core/init/resolveInstallConflicts.js';
import type { InstallPlan } from '../../src/core/init/types.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

function createPlan(files?: Partial<InstallPlan['files'][number]>[]): InstallPlan {
  return {
    projectName: 'demo',
    tool: 'claude',
    features: ['base', 'skills', 'commands', 'docs'],
    adapter: {
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
      getDestination: (feature) => (feature === 'skills' ? '.claude/skills' : '.claude/commands'),
      getRoot: () => '.',
      getPostInstallNotes: () => [],
    },
    files: (
      files ?? [
        {
          assetId: 'common-readme',
          sourcePath: '/tmp/source',
          destinationPath: '/tmp/README.md',
          kind: 'template',
          exists: true,
          appendable: true,
          resolution: 'unresolved',
        },
      ]
    ).map((file, index) => ({
      assetId: `asset-${index}`,
      sourcePath: `/tmp/source-${index}`,
      destinationPath: `/tmp/file-${index}.md`,
      kind: 'template',
      exists: true,
      appendable: true,
      resolution: 'unresolved',
      ...file,
    })),
    targetDir: '/tmp',
    dryRun: false,
    force: false,
    mode: 'init',
  };
}

describe('resolveInstallConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-skips conflicts when yes is enabled', async () => {
    const plan = await resolveInstallConflicts(createPlan(), { yes: true, force: false });
    expect(plan.files[0]?.resolution).toBe('skip');
  });

  it('auto-overwrites conflicts when force is enabled', async () => {
    const plan = await resolveInstallConflicts(createPlan(), { yes: false, force: true });
    expect(plan.files[0]?.resolution).toBe('overwrite');
  });

  it('applies append-all-safe to appendable and non-appendable files', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({ resolution: 'append-all-safe' });
    const plan = await resolveInstallConflicts(
      createPlan([
        { destinationPath: '/tmp/README.md', appendable: true },
        { destinationPath: '/tmp/config.json', appendable: false },
      ]),
      { yes: false, force: false },
    );

    expect(plan.files[0]?.resolution).toBe('append');
    expect(plan.files[1]?.resolution).toBe('skip');
  });

  it('shows progress and bulk actions in the prompt', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({ resolution: 'skip-all' });
    await resolveInstallConflicts(createPlan(), { yes: false, force: false });

    expect(vi.mocked(prompts)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '[1/1] 检测到重复文件：/tmp/README.md',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'overwrite-all' }),
          expect.objectContaining({ value: 'skip-all' }),
          expect.objectContaining({ value: 'append-all-safe' }),
        ]),
      }),
      expect.objectContaining({ onCancel: expect.any(Function) }),
    );
  });
});
