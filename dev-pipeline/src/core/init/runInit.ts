import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import pc from 'picocolors';
import { loadToolRegistry } from '../adapters/registry.js';
import type { InitOptions } from '../prompts/types.js';
import { PACKAGE_NAME } from '../runtime/meta.js';
import { resolvePackageRoot } from '../runtime/resolvePackageRoot.js';
import { buildInstallPlan } from './buildInstallPlan.js';
import { collectInputs } from './collectInputs.js';
import { executeInstallPlan } from './executeInstallPlan.js';
import { resolveInstallConflicts } from './resolveInstallConflicts.js';
import { validateTarget } from './validateTarget.js';

const execFile = promisify(execFileCallback);
const MIN_OPENSPEC_VERSION = [1, 6, 0] as const;

function parseVersion(value: string): number[] | null {
  const match = value.match(/(?:^|\s|v)(\d+)\.(\d+)\.(\d+)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isVersionAtLeast(version: number[], minimum: readonly number[]): boolean {
  for (let index = 0; index < minimum.length; index += 1) {
    const current = version[index] ?? 0;
    const required = minimum[index] ?? 0;
    if (current !== required) return current > required;
  }
  return true;
}

export async function preflightOpenSpec(): Promise<void> {
  let stdout: string;
  try {
    ({ stdout } = await execFile('openspec', ['--version']));
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new Error('openspec CLI not found. Install OpenSpec >= 1.6.0 before running init.');
    }
    throw new Error(
      `Unable to run openspec --version: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const version = parseVersion(stdout);
  if (!version || !isVersionAtLeast(version, MIN_OPENSPEC_VERSION)) {
    throw new Error(
      `OpenSpec ${stdout.trim() || 'version unknown'} is unsupported. Install OpenSpec >= 1.6.0.`,
    );
  }
}

async function initializeOpenSpec(targetDir: string, tool: InitOptions['tool']): Promise<void> {
  if (!tool) {
    throw new Error('Cannot initialize OpenSpec without a selected AI tool.');
  }

  const configPath = path.join(targetDir, 'openspec', 'config.yaml');
  const hadConfig = await fs.pathExists(configPath);
  try {
    await execFile('openspec', ['init', '--tools', tool], { cwd: targetDir });
  } catch (error) {
    throw new Error(
      `OpenSpec initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // OpenSpec creates a default config. The stack-config asset owns the replacement
  // when this is a new project, while existing user config remains conflict-managed.
  if (!hadConfig && (await fs.pathExists(configPath))) {
    await fs.remove(configPath);
  }
}

export async function runInit(options: InitOptions): Promise<void> {
  const rootDir = await resolvePackageRoot(import.meta.url);
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const registry = await loadToolRegistry(rootDir);

  if (options.tool && !registry.has(options.tool)) {
    throw new Error(
      `Unsupported tool: ${options.tool}. Run "${PACKAGE_NAME} list-tools" to see supported ids.`,
    );
  }

  const validation = await validateTarget(targetDir, registry);

  await preflightOpenSpec();

  if (validation.existingEntries.length > 0 && !options.force && !options.dryRun) {
    console.log(
      pc.yellow(`Target directory is not empty: ${validation.existingEntries.join(', ')}`),
    );
    console.log(pc.yellow('Use --force to allow overwriting managed files.'));
  }

  const answers = await collectInputs(
    targetDir,
    {
      ...options,
      tool: options.tool ?? validation.suggestedTool,
      // Programmatic callers without an explicit stack keep the backend default for compatibility;
      // the CLI command enforces an explicit --stack for --yes invocations.
      stack: options.stack ?? 'backend',
    },
    registry,
  );
  if (!options.dryRun) {
    await initializeOpenSpec(targetDir, answers.tool);
  }
  const plan = await buildInstallPlan({
    rootDir,
    targetDir,
    projectName: answers.projectName,
    tool: answers.tool,
    stack: answers.stack,
    techStack: answers.techStack,
    language: answers.language,
    features: answers.features,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    mode: 'init',
    registry,
  });
  const resolvedPlan = await resolveInstallConflicts(plan, {
    yes: Boolean(options.yes),
    force: Boolean(options.force),
  });

  await executeInstallPlan(resolvedPlan);
}
