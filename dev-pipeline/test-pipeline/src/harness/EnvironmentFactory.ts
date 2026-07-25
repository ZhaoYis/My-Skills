import type { TestEnvironment, EnvironmentConfig } from './types.js';
import { createTempDir, copyDir, cleanupAllTempDirs } from '../utils/tempDir.js';
import { gitInit, gitCommit, gitIsWorkTree } from '../utils/gitHelpers.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import { runInit } from '../../../src/core/init/runInit.js';

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
  const executable = path.join(binDir, 'openspec');
  await fs.writeFile(
    executable,
    `#!/usr/bin/env bash
set -euo pipefail

if [[ "\${1:-}" == "--version" ]]; then
  printf '%s\\n' '1.6.0-e2e'
  exit 0
fi

case "\${1:-}" in
  list)
    printf '{"changes":[],"root":{"path":"%s","source":"config"}}\\n' "$PWD"
    ;;
  new)
    name="\${3:-}"
    mkdir -p "openspec/changes/$name"
    printf '{"status":"ok","change":"%s"}\\n' "$name"
    ;;
  status)
    printf '%s\\n' '{"artifacts":[{"id":"proposal","status":"ready"},{"id":"design","status":"ready"},{"id":"tasks","status":"ready"},{"id":"specs","status":"ready"}]}'
    ;;
  instructions)
    printf '%s\\n' '{"state":"ready","contextFiles":[],"instruction":"e2e fixture instruction"}'
    ;;
  validate)
    printf '%s\\n' '{"valid":true,"issues":[]}'
    ;;
  archive)
    name="\${2:-}"
    tasks="openspec/changes/$name/tasks.md"
    if [[ -f "$tasks" ]] && grep -q '\\[ \\]' "$tasks"; then
      printf '%s\\n' '{"status":"error","reason":"pending-tasks"}'
      exit 9
    fi
    archive_path="openspec/changes/archive/2099-01-01-$name"
    mkdir -p "$(dirname "$archive_path")"
    mv "openspec/changes/$name" "$archive_path"
    printf '{"status":"ok","archivePath":"%s"}\\n' "$archive_path"
    ;;
  *)
    printf '%s\\n' '{"status":"error","reason":"unsupported-e2e-command"}'
    exit 8
    ;;
esac
`,
    'utf8',
  );
  await fs.chmod(executable, 0o755);
}

export { SAMPLES_ROOT };
