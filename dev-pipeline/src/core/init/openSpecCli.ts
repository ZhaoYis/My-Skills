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
  if (code === 'ENOENT') return true;
  if (platform !== 'win32' || (code !== 1 && code !== '1')) return false;

  // cmd.exe exits 1 both when a command cannot be found and when the command
  // itself fails, so classify the error as "missing" only when stderr carries
  // cmd.exe's own command-not-found message.
  const stderr = (error as { stderr?: unknown }).stderr;
  return typeof stderr === 'string' && /not recognized|不是内部或外部命令/i.test(stderr);
}

export function resolveOpenSpecInvocation(
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): OpenSpecInvocation {
  if (platform === 'win32') {
    validateArgsForWindows(args);
    // Use the bare command name so cmd.exe resolves it through PATHEXT: this
    // finds .cmd/.bat npm shims as well as native .exe installs.
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'openspec', ...args],
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
