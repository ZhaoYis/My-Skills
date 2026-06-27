import type { TestEnvironment, EnvironmentConfig } from './types.js';
import { createTempDir, copyDir, cleanupAllTempDirs, fileExists } from '../utils/tempDir.js';
import { gitInit, gitCommit, gitIsWorkTree, gitCurrentBranch } from '../utils/gitHelpers.js';
import { isOpenspecAvailable, openspecInit } from '../utils/openspecHelpers.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_ROOT = path.resolve(__dirname, '../../samples');

/**
 * Create a test environment with a fullstack sample project,
 * git repository, OpenSpec init, and opsx-dev-pipeline templates.
 */
export async function createTestEnvironment(
  config: EnvironmentConfig = {}
): Promise<TestEnvironment> {
  const {
    sampleProject = 'fullstack-todo',
    toolId = 'claude',
    features = [],
    schemaConfig,
    skipPipelineInit = false,
  } = config;

  // 1. Create temp directory
  const rootDir = await createTempDir(`opsx-delivery-${toolId}-`);

  // 2. Copy sample project from samples/
  const sampleDir = path.join(SAMPLES_ROOT, sampleProject);
  await copyDir(sampleDir, rootDir);

  // 3. Initialize git repository
  await gitInit(rootDir);
  const isWorkTree = await gitIsWorkTree(rootDir);

  // 4. Create initial git commit
  await gitCommit(rootDir, 'chore: initial project setup');

  // 5. Initialize OpenSpec
  const openspecCheck = await isOpenspecAvailable();
  let openspecInitResult: string | undefined;
  if (openspecCheck.available) {
    const result = await openspecInit(rootDir);
    openspecInitResult = result.stdout;
    // Re-commit after openspec init adds files
    await gitCommit(rootDir, 'chore: openspec init');
  }

  // 6. Copy the sample's openspec config as default
  const sampleOpenspecConfig = path.join(sampleDir, 'openspec', 'config.yaml');
  if (await fileExists(sampleOpenspecConfig)) {
    const fs = await import('fs-extra');
    await fs.ensureDir(path.join(rootDir, 'openspec'));
    await fs.copyFile(sampleOpenspecConfig, path.join(rootDir, 'openspec', 'config.yaml'));
  }

  // 7. Apply custom openspec config if provided (overrides sample default)
  if (schemaConfig) {
    const configPath =
      schemaConfig === 'custom-backend'
        ? path.join(SAMPLES_ROOT, 'schema-variants', 'custom-backend.yaml')
        : schemaConfig === 'custom-frontend'
          ? path.join(SAMPLES_ROOT, 'schema-variants', 'custom-frontend.yaml')
          : schemaConfig;

    const fs = await import('fs-extra');
    await fs.ensureDir(path.join(rootDir, 'openspec'));
    await fs.copyFile(configPath, path.join(rootDir, 'openspec', 'config.yaml'));
  }

  // 8. Run opsx-dev-pipeline init (unless skipped for error tests)
  let pipelineInitResult: string | undefined;
  if (!skipPipelineInit) {
    try {
      // Try local build first
      const pipelineRoot = path.resolve(__dirname, '../../..');
      const result = await execFileAsync('npx', [
        'tsx',
        path.join(pipelineRoot, 'src/bin/opsx-dev-pipeline.ts'),
        'init',
        '--tool', toolId,
        '--yes',
        ...features.flatMap(f => ['--feature', f]),
      ], { cwd: rootDir });
      pipelineInitResult = result.stdout;
    } catch {
      // Fallback: try installed CLI
      try {
        const result = await execFileAsync('npx', [
          'opsx-dev-pipeline',
          'init',
          '--tool', toolId,
          '--yes',
          ...features.flatMap(f => ['--feature', f]),
        ], { cwd: rootDir });
        pipelineInitResult = result.stdout;
      } catch (e) {
        pipelineInitResult = `Pipeline init failed: ${String(e)}`;
      }
    }
  }

  // Determine paths
  const skillsRoot = path.join(rootDir, '.claude', 'skills');
  const commandsRoot = path.join(rootDir, '.claude', 'commands');
  const knowledgeRoot = path.join(rootDir, '.knowledge');

  return {
    rootDir,
    toolId,
    sampleProject,
    skillsRoot,
    commandsRoot,
    knowledgeRoot,
    isWorkTree,
    openspecAvailable: openspecCheck.available,
    openspecVersion: openspecCheck.version,
    pipelineInitResult,
    openspecInitResult,
    async cleanup() {
      await cleanupAllTempDirs();
    },
  };
}

export { SAMPLES_ROOT };
