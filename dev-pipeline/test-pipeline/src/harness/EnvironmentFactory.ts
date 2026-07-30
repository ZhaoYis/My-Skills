import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import { runInit } from '../../../src/core/init/runInit.js';
import { gitCommit, gitInit, gitIsWorkTree } from '../utils/gitHelpers.js';
import { cleanupAllTempDirs, copyDir, createTempDir } from '../utils/tempDir.js';
import type { EnvironmentConfig, TestEnvironment } from './types.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_ROOT = path.resolve(__dirname, '../../samples');

/**
 * Create a test environment with a fullstack sample project,
 * git repository, OpenSpec init, and opsx-dev-pipeline templates.
 */
export async function createTestEnvironment(
  config: EnvironmentConfig = {},
): Promise<TestEnvironment> {
  const {
    sampleProject = 'fullstack-todo',
    toolId = 'claude',
    features = [],
    changeName = 'e2e-change',
    openspecMode = 'mock',
  } = config;

  // 1. Create temp directory
  const rootDir = await createTempDir(`opsx-delivery-${toolId}-`);

  // 2. Copy sample project from samples/
  const sampleDir = path.join(SAMPLES_ROOT, sampleProject);
  await copyDir(sampleDir, rootDir);

  // 3. Initialize the repository and install the current templates directly.
  await gitInit(rootDir);
  const isWorkTree = await gitIsWorkTree(rootDir);
  await runInit({
    dir: rootDir,
    tool: toolId,
    yes: true,
    force: true,
    dryRun: false,
    feature: features,
  });

  const toolPaths = {
    claude: { skills: '.claude/skills', commands: '.claude/commands' },
    cursor: { skills: '.cursor/rules', commands: '.cursor/commands' },
    codex: { skills: '.codex/prompts', commands: '.codex/commands' },
  } as const;
  const skillsRoot = path.join(rootDir, toolPaths[toolId].skills);
  const skillRoot = path.join(skillsRoot, 'opsx-dev-pipeline');
  const commandsRoot = path.join(rootDir, toolPaths[toolId].commands);

  let mockBinDir: string | undefined;
  if (openspecMode === 'mock') {
    mockBinDir = await createTempDir('opsx-openspec-bin-');
    await installMockOpenspec(mockBinDir);
  }

  // Commit the fixture and publish target branch before feature work begins.
  await gitCommit(rootDir, 'chore: initialize e2e fixture');
  const targetBranch = 'main';
  const sourceBranch = `feature/${changeName}`;
  const remoteRoot = await createTempDir('opsx-delivery-remote-');
  const remotePath = path.join(remoteRoot, 'origin.git');
  await execFileAsync('git', ['init', '--bare', remotePath]);
  await execFileAsync('git', ['remote', 'add', 'origin', remotePath], { cwd: rootDir });
  await execFileAsync('git', ['push', '-u', 'origin', targetBranch], { cwd: rootDir });
  await execFileAsync('git', ['checkout', '-b', sourceBranch], { cwd: rootDir });

  return {
    rootDir,
    toolId,
    sampleProject,
    skillsRoot,
    skillRoot,
    commandsRoot,
    mockBinDir,
    sourceBranch,
    targetBranch,
    remotePath,
    openspecMode,
    isWorkTree,
    openspecAvailable: openspecMode === 'mock',
    openspecVersion: openspecMode === 'mock' ? '1.6.0-e2e' : undefined,
    pipelineInitResult: `initialized ${toolId}`,
    async cleanup() {
      await cleanupAllTempDirs();
    },
  };
}

async function installMockOpenspec(binDir: string): Promise<void> {
  await fs.ensureDir(binDir);
  const mock = `
import fs from 'node:fs';
import path from 'node:path';

const command = process.argv[2];
if (command === '--version') {
  process.stdout.write('1.6.0-e2e\\n');
  process.exit(0);
}

switch (command) {
  case 'list':
    process.stdout.write(JSON.stringify({
      changes: [], root: { path: process.cwd(), source: 'config' }
    }) + '\\n');
    break;
  case 'new': {
    const name = process.argv[4] || '';
    fs.mkdirSync(path.join('openspec', 'changes', name), { recursive: true });
    process.stdout.write(JSON.stringify({ status: 'ok', change: name }) + '\\n');
    break;
  }
  case 'status':
    process.stdout.write('{"artifacts":[{"id":"proposal","status":"ready"},{"id":"design","status":"ready"},{"id":"tasks","status":"ready"},{"id":"specs","status":"ready"}]}\\n');
    break;
  case 'instructions':
    process.stdout.write('{"state":"ready","contextFiles":[],"instruction":"e2e fixture instruction"}\\n');
    break;
  case 'validate':
    process.stdout.write('{"valid":true,"issues":[]}\\n');
    break;
  case 'archive': {
    const name = process.argv[3] || '';
    const source = path.join('openspec', 'changes', name);
    const tasks = path.join(source, 'tasks.md');
    if (fs.existsSync(tasks) && fs.readFileSync(tasks, 'utf8').includes('[ ]')) {
      process.stdout.write('{"status":"error","reason":"pending-tasks"}\\n');
      process.exit(9);
    }
    const archivePath = path.join('openspec', 'changes', 'archive', '2099-01-01-' + name);
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.renameSync(source, archivePath);
    process.stdout.write(JSON.stringify({ status: 'ok', archivePath }) + '\\n');
    break;
  }
  default:
    process.stdout.write('{"status":"error","reason":"unsupported-e2e-command"}\\n');
    process.exit(8);
}
`;
  const script = path.join(binDir, 'openspec.mjs');
  await fs.writeFile(script, mock, 'utf8');
  if (process.platform === 'win32') {
    await fs.writeFile(
      path.join(binDir, 'openspec.cmd'),
      `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`,
      'utf8',
    );
  } else {
    const executable = path.join(binDir, 'openspec');
    await fs.writeFile(executable, `#!/usr/bin/env node\n${mock}`, 'utf8');
    await fs.chmod(executable, 0o755);
  }
}

export { SAMPLES_ROOT };
