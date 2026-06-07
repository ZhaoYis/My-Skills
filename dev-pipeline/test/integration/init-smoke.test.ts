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
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/assets/decision-point-index.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/references/phase-0-entrance.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-learn/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-learn/references/phase-1-understand-goal.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-learn/assets/write-targets.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/references/phase-1-clarify-requirement.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/references/phase-2-explore-context.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/references/phase-3-split-capabilities.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/references/phase-4-assess-impact.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/references/phase-5-output-analysis.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/assets/analysis-output-template.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/assets/evidence-standards.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/assets/maintenance-index.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/assets/question-checklist.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-analysis/scripts/opsx-analysis-preflight.sh'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/commands/opsx-learn.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/commands/opsx-analysis.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/commands/review.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'opsx-dev-pipeline.json'))).toBe(true);
  });
});
