import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const execFileAsync = promisify(execFile);
const rootDir = PACKAGE_ROOT;
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
  it('contains runnable bins and excludes removed templates', async () => {
    const { stdout } = await execFileAsync('tar', ['-tf', path.join(rootDir, tarball)]);
    expect(stdout).toContain('package/dist/bin/opsx-dev-pipeline.js');
    expect(stdout).toContain('package/dist/bin/create-opsx-dev-pipeline.js');
    expect(stdout).not.toContain('package/dist/test/');

    // Retained templates are present
    expect(stdout).toContain('package/templates/common/skills/opsx-dev-pipeline/');
    expect(stdout).toContain(
      'package/templates/common/skills/opsx-dev-pipeline/agents/openai.yaml',
    );

    // Removed preset skills are absent from tarball
    const removed = [
      'opsx-learn',
      'opsx-analysis',
      'opsx-design',
      'opsx-verify',
      'opsx-clarify',
      'opsx-health',
      'opsx-pr',
      'opsx-prototype',
      'opsx-ci-triage',
      'git-commit-push',
      'git-code-review',
      'git-merge-branch',
      'file-code-review',
    ];
    for (const name of removed) {
      expect(stdout).not.toContain(`templates/common/skills/${name}/`);
      expect(stdout).not.toContain(`templates/common/commands/${name}.md`);
    }
  }, 10000);

  it('runs the packaged CLI and initializes from the tarball install', async () => {
    const installDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-'));
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-target-'));
    createdDirs.push(installDir, targetDir);

    await execFileAsync('npm', ['init', '-y'], { cwd: installDir });
    await execFileAsync('npm', ['install', path.join(rootDir, tarball)], {
      cwd: installDir,
      timeout: 30000,
    });
    const binPath = path.join(installDir, 'node_modules', '.bin', 'opsx-dev-pipeline');
    const createBinPath = path.join(installDir, 'node_modules', '.bin', 'create-opsx-dev-pipeline');

    const help = await execFileAsync(binPath, ['--help'], { cwd: installDir, timeout: 30000 });
    const createHelp = await execFileAsync(createBinPath, ['--help'], {
      cwd: installDir,
      timeout: 30000,
    });
    expect(help.stdout).toContain('opsx-dev-pipeline');
    expect(createHelp.stdout).toContain('opsx-dev-pipeline');

    await execFileAsync('npm', ['init', '-y'], { cwd: targetDir });
    await execFileAsync(binPath, ['init', '--tool', 'cursor', '--yes', '--dir', targetDir], {
      cwd: installDir,
      timeout: 30000,
    });
    expect(await fs.pathExists(path.join(targetDir, 'opsx-dev-pipeline.json'))).toBe(false);

    const pkg = await fs.readJson(path.join(targetDir, 'package.json'));
    expect(pkg.opsxDevPipeline.tool).toBe('cursor');

    // Retained assets exist
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-dev-pipeline.mdc'))).toBe(
      true,
    );
    expect(
      await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-dev-pipeline/SKILL.md')),
    ).toBe(true);
    expect(
      await fs.pathExists(
        path.join(targetDir, '.cursor/rules/opsx-dev-pipeline/agents/openai.yaml'),
      ),
    ).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/commands/opsx-dev-pipeline.md'))).toBe(
      true,
    );

    // Removed preset skills and commands are absent from generated output
    const removed = [
      'opsx-learn',
      'opsx-analysis',
      'opsx-design',
      'opsx-verify',
      'opsx-clarify',
      'opsx-health',
      'opsx-pr',
      'opsx-prototype',
      'opsx-ci-triage',
      'git-commit-push',
      'git-code-review',
      'git-merge-branch',
      'file-code-review',
    ];
    for (const name of removed) {
      expect(await fs.pathExists(path.join(targetDir, '.cursor/rules', name, 'SKILL.md'))).toBe(
        false,
      );
      expect(await fs.pathExists(path.join(targetDir, '.cursor/commands', `${name}.md`))).toBe(
        false,
      );
    }
  }, 45000);
});
