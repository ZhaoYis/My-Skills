import { type CommandRunner, NodeCommandRunner } from './command-runner.js';
import type { GitTools, ToolResponse } from './protocol.js';

export class GitAdapter implements GitTools {
  constructor(
    private readonly rootDir: string,
    private readonly runner: CommandRunner = new NodeCommandRunner(),
  ) {}

  private async command<T = string>(args: string[]): Promise<ToolResponse<T>> {
    try {
      const result = await this.runner.run('git', args, { cwd: this.rootDir });
      if (result.exitCode !== 0) {
        return {
          status: 'failed',
          summary: result.stderr || result.stdout || `git exited ${result.exitCode}`,
        };
      }
      return {
        status: 'succeeded',
        summary: 'git command succeeded',
        value: result.stdout.trim() as T,
        evidence: [
          { type: 'command', value: ['git', ...args] },
          { type: 'stdout', value: result.stdout },
        ],
      };
    } catch (error) {
      return { status: 'failed', summary: error instanceof Error ? error.message : String(error) };
    }
  }

  status(): Promise<ToolResponse> {
    return this.command(['status', '--short']);
  }

  diff(input: { staged?: boolean } = {}): Promise<ToolResponse> {
    return this.command(input.staged ? ['diff', '--cached'] : ['diff', 'HEAD']);
  }

  branch(): Promise<ToolResponse<string>> {
    return this.command<string>(['branch', '--show-current']);
  }

  fetch(input: { remote?: string; branch?: string } = {}): Promise<ToolResponse> {
    return this.command([
      'fetch',
      '--prune',
      input.remote ?? 'origin',
      ...(input.branch ? [input.branch] : []),
    ]);
  }

  stage(input: { paths: string[] }): Promise<ToolResponse> {
    if (input.paths.length === 0)
      return Promise.resolve({
        status: 'blocked',
        summary: 'git stage requires at least one path',
      });
    return this.command(['add', '--', ...input.paths]);
  }

  async commit(input: { message: string }): Promise<ToolResponse<{ sha: string }>> {
    const result = await this.command(['commit', '-m', input.message]);
    if (result.status !== 'succeeded') return result as unknown as ToolResponse<{ sha: string }>;
    const sha = await this.command<string>(['rev-parse', 'HEAD']);
    if (sha.status !== 'succeeded') return sha as unknown as ToolResponse<{ sha: string }>;
    return { ...result, value: { sha: sha.value ?? '' } };
  }

  push(input: { remote?: string; branch: string }): Promise<ToolResponse> {
    return this.command(['push', input.remote ?? 'origin', input.branch]);
  }

  merge(input: {
    source: string;
    target: string;
    strategy: 'standard' | 'squash' | 'no-ff';
  }): Promise<ToolResponse> {
    const strategy =
      input.strategy === 'squash'
        ? ['--squash']
        : input.strategy === 'no-ff'
          ? ['--no-ff', '--no-edit']
          : ['--no-edit'];
    return this.command(['merge', ...strategy, input.source]);
  }

  listConflicts(): Promise<ToolResponse<string[]>> {
    return this.command<string>(['diff', '--name-only', '--diff-filter=U']).then((result) => ({
      ...result,
      value:
        result.status === 'succeeded'
          ? result.value
            ? result.value.split('\n').filter(Boolean)
            : []
          : undefined,
    }));
  }
}
