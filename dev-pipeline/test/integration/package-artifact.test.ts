import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const rootDir = '/Users/mrzhaoyi/Workspace/LLM/My-Skills/dev-pipeline';
const createdDirs: string[] = [];
let tarball = '';

beforeAll(async () => {
  await execFileAsync('npm', ['run', 'build'], { cwd: rootDir });
  const { stdout } = await execFileAsync('npm', ['pack'], { cwd: rootDir });
  tarball = stdout.trim().split('\n').pop() ?? '';
});

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('packaged artifact', () => {
  it('contains runnable bins and excludes compiled tests', async () => {
    const { stdout } = await execFileAsync('tar', ['-tf', path.join(rootDir, tarball)]);
    expect(stdout).toContain('package/dist/bin/opsx-dev-pipeline.js');
    expect(stdout).toContain('package/dist/bin/create-opsx-dev-pipeline.js');
    expect(stdout).not.toContain('package/dist/test/');
  });

  it('runs the packaged CLI and initializes from the tarball install', async () => {
    const installDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-'));
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pack-target-'));
    createdDirs.push(installDir, targetDir);

    await execFileAsync('npm', ['init', '-y'], { cwd: installDir });
    await execFileAsync('npm', ['install', path.join(rootDir, tarball)], { cwd: installDir });
    const binPath = path.join(installDir, 'node_modules', '.bin', 'opsx-dev-pipeline');
    const createBinPath = path.join(installDir, 'node_modules', '.bin', 'create-opsx-dev-pipeline');

    const help = await execFileAsync(binPath, ['--help'], { cwd: installDir });
    const createHelp = await execFileAsync(createBinPath, ['--help'], { cwd: installDir });
    expect(help.stdout).toContain('opsx-dev-pipeline');
    expect(createHelp.stdout).toContain('opsx-dev-pipeline');

    await execFileAsync(binPath, ['init', '--tool', 'cursor', '--yes', '--dir', targetDir], { cwd: installDir });
    expect(await fs.pathExists(path.join(targetDir, 'opsx-dev-pipeline.json'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, '.cursor/rules/opsx-dev-pipeline.mdc'))).toBe(true);
  });
});
