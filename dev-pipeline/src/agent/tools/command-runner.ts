import { execFile } from 'node:child_process';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(
    command: string,
    args: string[],
    options?: { cwd?: string; timeoutMs?: number },
  ): Promise<CommandResult>;
}

export class NodeCommandRunner implements CommandRunner {
  async run(
    command: string,
    args: string[],
    options: { cwd?: string; timeoutMs?: number } = {},
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd: options.cwd,
          timeout: options.timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (!error) {
            resolve({ exitCode: 0, stdout, stderr });
            return;
          }
          const exitCode = typeof error.code === 'number' ? error.code : 1;
          if (error.code === 'ENOENT') {
            reject(new Error(`command-not-found: ${command}`));
            return;
          }
          resolve({ exitCode, stdout, stderr });
        },
      );
    });
  }
}

export function parseCommandLine(commandLine: string): { command: string; args: string[] } {
  const parts = commandLine.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const unquote = (value: string) =>
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
      ? value.slice(1, -1)
      : value;
  const [command, ...args] = parts.map(unquote);
  if (!command) throw new Error('empty-command');
  return { command, args };
}
