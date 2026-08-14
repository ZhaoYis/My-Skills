import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

interface OpenSpecInvocation {
  command: string;
  args: string[];
}

/**
 * Characters that have special meaning in cmd.exe and could be used for injection.
 * See: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd
 */
const CMD_METACHARACTERS = /[&|;%^<>`]/;

/**
 * Validate that arguments do not contain cmd.exe metacharacters.
 * Throws an error if a dangerous character is detected.
 */
function validateArgsForWindows(args: readonly string[]): void {
  for (const arg of args) {
    if (CMD_METACHARACTERS.test(arg)) {
      throw new Error(
        `Rejected argument containing shell metacharacters: "${arg}". ` +
          'Characters &, |, ;, %, ^, <, >, and ` are not allowed.',
      );
    }
  }
}

export function isOpenSpecCliMissingError(
  error: unknown,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;

  const code = error.code;
  return code === 'ENOENT' || (platform === 'win32' && (code === 1 || code === '1'));
}

export function resolveOpenSpecInvocation(
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): OpenSpecInvocation {
  if (platform === 'win32') {
    validateArgsForWindows(args);
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'openspec.cmd', ...args],
    };
  }

  return {
    command: 'openspec',
    args: [...args],
  };
}

export async function execOpenSpec(
  args: readonly string[],
  options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
  const invocation = resolveOpenSpecInvocation(args);
  return execFile(invocation.command, invocation.args, { ...options, encoding: 'utf8' });
}
