import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const execFileAsync = promisify(execFile);
const rootDir = PACKAGE_ROOT;
const createdDirs: string[] = [];
const PACKAGE_INSTALL_TIMEOUT_MS = 120000;
const PACKAGE_TEST_TIMEOUT_MS = 180000;
let tarball = '';

function execNpm(args: string[], options: { cwd: string; timeout?: number }) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd', ...args] : args;
  return execFileAsync(command, commandArgs, options);
}

function execPackageBin(
  binPath: string,
  args: string[],
  options: { cwd: string; timeout?: number },
) {
  if (process.platform === 'win32') {
    return execFileAsync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `${binPath}.cmd`, ...args],
      options,
    );
  }
  return execFileAsync(binPath, args, options);
}

beforeAll(async () => {
  await execNpm(['run', 'build'], { cwd: rootDir });
  const { stdout } = await execNpm(['pack'], { cwd: rootDir });
  tarball = stdout.trim().split('\n').pop() ?? '';
}, PACKAGE_INSTALL_TIMEOUT_MS);

afterAll(async () => {
  await cleanupDirectories(createdDirs);
}, 30000);

describe('packaged artifact', () => {
  it('contains runnable bins and excludes removed templates', async () => {
    const { stdout } = await execFileAsync('tar', ['-tf', tarball], { cwd: rootDir });
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

  it(
    'runs the packaged CLI and initializes from the tarball install',
    async () => {
      const installDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-'));
      const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-target-'));
      createdDirs.push(installDir, targetDir);

      await execNpm(['init', '-y'], { cwd: installDir });
      await execNpm(
        ['install', '--prefer-offline', '--no-audit', '--no-fund', path.join(rootDir, tarball)],
        {
          cwd: installDir,
          timeout: PACKAGE_INSTALL_TIMEOUT_MS,
        },
      );
      const binPath = path.join(installDir, 'node_modules', '.bin', 'opsx-dev-pipeline');
      const createBinPath = path.join(
        installDir,
        'node_modules',
        '.bin',
        'create-opsx-dev-pipeline',
      );

      const help = await execPackageBin(binPath, ['--help'], {
        cwd: installDir,
        timeout: 30000,
      });
      const createHelp = await execPackageBin(createBinPath, ['--help'], {
        cwd: installDir,
        timeout: 30000,
      });
      expect(help.stdout).toContain('opsx-dev-pipeline');
      expect(createHelp.stdout).toContain('opsx-dev-pipeline');

      await execNpm(['init', '-y'], { cwd: targetDir });
      await execPackageBin(
        binPath,
        [
          'init',
          '--tool',
          'cursor',
          '--stack',
          'backend',
          '--lang',
          'en',
          '--yes',
          '--dir',
          targetDir,
        ],
        {
          cwd: installDir,
          timeout: 30000,
        },
      );
      expect(await fs.pathExists(path.join(targetDir, 'opsx-dev-pipeline.json'))).toBe(false);

      const pkg = await fs.readJson(path.join(targetDir, 'package.json'));
      expect(pkg.opsxDevPipeline.tool).toBe('cursor');
      expect(pkg.opsxDevPipeline.language).toBe('en');
      expect(await fs.readFile(path.join(targetDir, 'README.md'), 'utf8')).toContain(
        '## Quick start',
      );

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
      expect(
        await fs.pathExists(path.join(targetDir, '.cursor/commands/opsx-dev-pipeline.md')),
      ).toBe(true);

      // Removed preset skills and commands are absent from generated output
      const removed = [
        'opsx-learn',
        'opsx-analysis',
        'opsx-design',
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
    },
    PACKAGE_TEST_TIMEOUT_MS,
  );
});
