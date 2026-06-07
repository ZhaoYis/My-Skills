import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';
import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { runInit } from '../../src/core/init/runInit.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

const toolExpectations = {
  claude: ['CLAUDE.md', '.claude/skills/dev-pipeline/SKILL.md', '.claude/skills/dev-pipeline/references/phase-0-entrance.md', '.claude/skills/dev-pipeline/assets/decision-point-index.md', '.claude/skills/dev-pipeline/scripts/dev-pipeline-preflight.sh', '.claude/commands/dev-pipeline.md', '.claude/commands/review.md'],
  cursor: ['.cursor/rules/opsx-dev-pipeline.mdc', '.cursor/rules/dev-pipeline/SKILL.md', '.cursor/rules/dev-pipeline/references/phase-0-entrance.md', '.cursor/rules/dev-pipeline/assets/decision-point-index.md', '.cursor/rules/dev-pipeline/scripts/dev-pipeline-preflight.sh', '.cursor/commands/dev-pipeline.md', '.cursor/commands/review.md', '.cursor/commands/README.md'],
  codex: ['.codex/prompts/opsx-dev-pipeline.md', '.codex/prompts/dev-pipeline/SKILL.md', '.codex/prompts/dev-pipeline/references/phase-0-entrance.md', '.codex/prompts/dev-pipeline/assets/decision-point-index.md', '.codex/prompts/dev-pipeline/scripts/dev-pipeline-preflight.sh', '.codex/commands/dev-pipeline.md', '.codex/commands/review.md', '.codex/commands/README.md'],
  generic: ['.ai/README.md', '.ai/skills/dev-pipeline/SKILL.md', '.ai/skills/dev-pipeline/references/phase-0-entrance.md', '.ai/skills/dev-pipeline/assets/decision-point-index.md', '.ai/skills/dev-pipeline/scripts/dev-pipeline-preflight.sh', '.ai/commands/dev-pipeline.md', '.ai/commands/review.md']
} as const;

describe('tool matrix', () => {
  it.each(Object.entries(toolExpectations))('initializes %s successfully', async (tool, expectedFiles) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-${tool}-`));
    createdDirs.push(dir);

    await runInit({ dir, tool: tool as 'claude' | 'cursor' | 'codex' | 'generic', yes: true, force: false, dryRun: false });

    for (const file of expectedFiles) {
      expect(await fs.pathExists(path.join(dir, file))).toBe(true);
    }

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
    expect(await fs.pathExists(path.join(dir, expectedFiles[1].split('/').slice(0, -1).join('/'), 'tests'))).toBe(false);
  });

  it('supports dry-run without writing files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-dry-run-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: true });
    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);
  });

  it('supports doctor, sync, and upgrade on an initialized repo', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-lifecycle-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'generic', yes: true, force: false, dryRun: false });
    await runDoctorCommand(dir);
    await runSyncCommand({ dir, force: true, dryRun: false });
    await runUpgradeCommand({ dir, force: true, dryRun: false });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
  });

  it('rejects overwrite without force in a non-empty managed destination', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-overwrite-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await expect(runSyncCommand({ dir, force: false, dryRun: false })).rejects.toThrow(/Refusing to overwrite existing file/);
  });
});
