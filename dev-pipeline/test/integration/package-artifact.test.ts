import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const rootDir = '/Users/mrzhaoyi/Workspace/LLM/My-Skills/dev-pipeline';
const createdDirs: string[] = [];
let tarball = '';

beforeAll(async () => {
  await execFileAsync('npm', ['run', 'build'], { cwd: rootDir });
  const { stdout } = await execFileAsync('npm', ['pack'], { cwd: rootDir });
  tarball = stdout.trim().split('\n').pop() ?? '';
}, 30000);

afterAll(async () => {
  for (const dir of createdDirs.splice(0)) {
    await fs.remove(dir);
  }
}, 30000);

describe('packaged artifact', () => {
  it('contains runnable bins and excludes compiled tests', async () => {
    const { stdout } = await execFileAsync('tar', ['-tf', path.join(rootDir, tarball)]);
    expect(stdout).toContain('package/dist/bin/opsx-dev-pipeline.js');
    expect(stdout).toContain('package/dist/bin/create-opsx-dev-pipeline.js');
    expect(stdout).not.toContain('package/dist/test/');
  }, 10000);

  it('runs the packaged CLI and initializes from the tarball install', async () => {
    const installDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-'));
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-target-'));
    createdDirs.push(installDir, targetDir);

    await execFileAsync('npm', ['init', '-y'], { cwd: installDir });
    await execFileAsync('npm', ['install', path.join(rootDir, tarball)], { cwd: installDir, timeout: 30000 });
    const binPath = path.join(installDir, 'node_modules', '.bin', 'opsx-dev-pipeline');
    const createBinPath = path.join(installDir, 'node_modules', '.bin', 'create-opsx-dev-pipeline');

    const help = await execFileAsync(binPath, ['--help'], { cwd: installDir, timeout: 30000 });
    const createHelp = await execFileAsync(createBinPath, ['--help'], { cwd: installDir, timeout: 30000 });
    expect(help.stdout).toContain('opsx-dev-pipeline');
    expect(createHelp.stdout).toContain('opsx-dev-pipeline');

    await execFileAsync(binPath, ['init', '--tool', 'cursor', '--yes', '--dir', targetDir], { cwd: installDir, timeout: 30000 });
    expect(await fs.pathExists(path.join(targetDir, 'opsx-dev-pipeline.json'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-dev-pipeline.mdc'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-learn/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-learn/scripts/opsx-learn-preflight.sh'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/references/phase-1-clarify-requirement.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/references/phase-2-explore-context.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/references/phase-3-split-capabilities.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/references/phase-4-assess-impact.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/references/phase-5-output-analysis.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/assets/analysis-output-template.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/assets/evidence-standards.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/assets/maintenance-index.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/assets/question-checklist.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-analysis/scripts/opsx-analysis-preflight.sh'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/commands/opsx-learn.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/commands/opsx-analysis.md'))).toBe(true);
  }, 45000);
});
