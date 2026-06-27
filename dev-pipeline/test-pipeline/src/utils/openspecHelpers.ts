import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Check if the openspec CLI is available in PATH.
 */
export async function isOpenspecAvailable(): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await execFileAsync('openspec', ['--version']);
    return { available: true, version: result.stdout.trim() };
  } catch {
    return { available: false };
  }
}

/**
 * Initialize OpenSpec in a directory.
 * Equivalent to: openspec init . --tools none --force
 */
export async function openspecInit(cwd: string): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync('openspec', ['init', '.', '--tools', 'none', '--force'], { cwd });
  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * Create a new OpenSpec change.
 */
export async function openspecNewChange(cwd: string, changeName: string): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync('openspec', ['new', 'change', changeName], { cwd });
  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * Get the status of an OpenSpec change as JSON.
 */
export async function openspecChangeStatus(cwd: string, changeName: string): Promise<unknown> {
  const result = await execFileAsync(
    'openspec', ['status', '--change', changeName, '--json'], { cwd }
  );
  return JSON.parse(result.stdout);
}

/**
 * List all OpenSpec changes as JSON.
 */
export async function openspecListChanges(cwd: string): Promise<unknown> {
  const result = await execFileAsync(
    'openspec', ['list', '--json'], { cwd }
  );
  return JSON.parse(result.stdout);
}

/**
 * Validate a specific change.
 */
export async function openspecValidateChange(cwd: string, changeName: string): Promise<unknown> {
  const result = await execFileAsync(
    'openspec', ['validate', '--type', 'change', changeName, '--json', '--no-interactive'], { cwd }
  );
  return JSON.parse(result.stdout);
}

/**
 * Validate all changes and specs.
 */
export async function openspecValidateAll(cwd: string): Promise<unknown> {
  const result = await execFileAsync(
    'openspec', ['validate', '--all', '--json', '--no-interactive'], { cwd }
  );
  return JSON.parse(result.stdout);
}

/**
 * Archive a change.
 */
export async function openspecArchive(
  cwd: string,
  changeName: string,
  options?: { skipSpecs?: boolean; yes?: boolean }
): Promise<{ stdout: string; stderr: string }> {
  const args = ['archive', changeName];
  if (options?.skipSpecs) args.push('--skip-specs');
  if (options?.yes) args.push('--yes');
  const result = await execFileAsync('openspec', args, { cwd });
  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * Get the OpenSpec instructions for a change artifact.
 */
export async function openspecInstructions(
  cwd: string,
  changeName: string,
  artifactId?: string
): Promise<unknown> {
  const args = ['instructions', changeName];
  if (artifactId) args.push(artifactId);
  args.push('--json');
  const result = await execFileAsync('openspec', args, { cwd });
  return JSON.parse(result.stdout);
}

/**
 * Write an openspec/config.yaml file.
 */
export async function writeOpenspecConfig(cwd: string, content: string): Promise<void> {
  const fs = await import('fs-extra');
  const configDir = path.join(cwd, 'openspec');
  await fs.ensureDir(configDir);
  await fs.writeFile(path.join(configDir, 'config.yaml'), content, 'utf-8');
}
