import { access } from 'node:fs/promises';
import path from 'node:path';
import { type CommandRunner, NodeCommandRunner } from './command-runner.js';
import type { OpenSpecTools, ToolResponse } from './protocol.js';

export class OpenSpecAdapter implements OpenSpecTools {
  constructor(
    private readonly rootDir: string,
    private readonly runner: CommandRunner = new NodeCommandRunner(),
  ) {}

  private async command<T = unknown>(args: string[], parseJson = true): Promise<ToolResponse<T>> {
    try {
      const result = await this.runner.run('openspec', args, { cwd: this.rootDir });
      if (result.exitCode !== 0) {
        return {
          status: 'failed',
          summary: result.stderr || result.stdout || `openspec exited ${result.exitCode}`,
        };
      }
      let value: T | undefined;
      if (parseJson && result.stdout.trim()) {
        try {
          value = JSON.parse(result.stdout) as T;
        } catch {
          return {
            status: 'failed',
            summary: 'openspec returned invalid JSON',
            evidence: [{ type: 'stdout', value: result.stdout }],
          };
        }
      }
      return {
        status: 'succeeded',
        summary: 'openspec command succeeded',
        value,
        evidence: [{ type: 'command', value: ['openspec', ...args] }],
      };
    } catch (error) {
      return { status: 'failed', summary: error instanceof Error ? error.message : String(error) };
    }
  }

  async preflight(): Promise<ToolResponse> {
    try {
      await access(path.join(this.rootDir, 'openspec', 'config.yaml'));
    } catch {
      return { status: 'blocked', summary: 'openspec/config.yaml not found' };
    }
    const version = await this.command<string>(['--version'], false);
    if (version.status !== 'succeeded') return version;
    const listed = await this.command(['list', '--json']);
    if (listed.status !== 'succeeded') return listed;
    return {
      status: 'succeeded',
      summary: 'OpenSpec preflight passed',
      value: listed.value,
      evidence: [...(version.evidence ?? []), ...(listed.evidence ?? [])],
    };
  }

  listChanges(): Promise<ToolResponse<unknown[]>> {
    return this.command<unknown[]>(['list', '--json']);
  }

  createChange(input: { changeName: string }): Promise<ToolResponse> {
    return this.command(['new', 'change', input.changeName, '--json']);
  }

  status(input: { changeName: string }): Promise<ToolResponse> {
    return this.command(['status', '--change', input.changeName, '--json']);
  }

  instructions(input: { changeName: string; artifact?: string }): Promise<ToolResponse> {
    const args = input.artifact
      ? ['instructions', input.artifact, '--change', input.changeName, '--json']
      : ['instructions', 'apply', '--change', input.changeName, '--json'];
    return this.command(args);
  }

  validate(input: { changeName: string }): Promise<ToolResponse> {
    return this.command([
      'validate',
      input.changeName,
      '--type',
      'change',
      '--json',
      '--no-interactive',
    ]);
  }

  apply(input: { changeName: string }): Promise<ToolResponse> {
    return this.command(['apply', input.changeName, '--json']);
  }

  archive(input: { changeName: string }): Promise<ToolResponse> {
    return this.command(['archive', input.changeName, '--json']);
  }
}
