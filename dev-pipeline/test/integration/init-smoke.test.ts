import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../../src/core/init/runInit.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('runInit', () => {
  it('writes claude bundled skill assets in a temp directory', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-dev-pipeline-'));
    createdDirs.push(dir);

    await runInit({
      dir,
      tool: 'claude',
      yes: true,
      force: false,
      dryRun: false
    });

    expect(await fs.pathExists(path.join(dir, 'CLAUDE.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/dev-pipeline/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/dev-pipeline/assets/decision-point-index.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/dev-pipeline/references/phase-0-entrance.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/dev-pipeline/scripts/dev-pipeline-preflight.sh'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/commands/review.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'opsx-dev-pipeline.json'))).toBe(true);
  });
});
