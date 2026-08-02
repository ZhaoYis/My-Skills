import type { PipelineRun } from '../domain/pipeline-state.js';
import { type CommandRunner, NodeCommandRunner } from './command-runner.js';
import { GitAdapter } from './git-adapter.js';
import { OpenSpecAdapter } from './openspec-adapter.js';
import type { ToolContext, ToolResponse } from './protocol.js';
import { TestAdapter } from './test-adapter.js';

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolResponse>;

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler): this {
    if (this.handlers.has(name)) throw new Error(`tool-already-registered: ${name}`);
    this.handlers.set(name, handler);
    return this;
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async execute(
    name: string,
    input: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResponse> {
    const handler = this.handlers.get(name);
    if (!handler) return { status: 'blocked', summary: `tool-not-registered: ${name}` };
    return handler(input, context);
  }
}

export function createLocalToolRegistry(
  rootDir: string,
  runner: CommandRunner = new NodeCommandRunner(),
): ToolRegistry {
  const openspec = new OpenSpecAdapter(rootDir, runner);
  const git = new GitAdapter(rootDir, runner);
  const tests = new TestAdapter(rootDir, runner);
  const registry = new ToolRegistry();

  registry.register('openspec.preflight', () => openspec.preflight());
  registry.register('openspec.listChanges', () => openspec.listChanges());
  registry.register('openspec.createChange', (input) =>
    openspec.createChange({ changeName: String(input.changeName) }),
  );
  registry.register('openspec.status', (input) =>
    openspec.status({ changeName: String(input.changeName) }),
  );
  registry.register('openspec.instructions', (input) =>
    openspec.instructions({
      changeName: String(input.changeName),
      artifact: input.artifact ? String(input.artifact) : undefined,
    }),
  );
  registry.register('openspec.validate', (input) =>
    openspec.validate({ changeName: String(input.changeName) }),
  );
  registry.register('openspec.apply', (input) =>
    openspec.apply({ changeName: String(input.changeName) }),
  );
  registry.register('openspec.archive', (input) =>
    openspec.archive({ changeName: String(input.changeName) }),
  );
  registry.register('git.status', () => git.status());
  registry.register('git.diff', (input) => git.diff({ staged: input.staged === true }));
  registry.register('git.branch', () => git.branch());
  registry.register('git.fetch', (input) =>
    git.fetch({
      remote: input.remote ? String(input.remote) : undefined,
      branch: input.branch ? String(input.branch) : undefined,
    }),
  );
  registry.register('git.stage', (input) =>
    git.stage({ paths: Array.isArray(input.paths) ? input.paths.map(String) : [] }),
  );
  registry.register('git.commit', (input) => git.commit({ message: String(input.message ?? '') }));
  registry.register('git.push', (input) =>
    git.push({
      remote: input.remote ? String(input.remote) : undefined,
      branch: String(input.branch ?? ''),
    }),
  );
  registry.register('git.merge', (input) =>
    git.merge({
      source: String(input.source ?? ''),
      target: String(input.target ?? ''),
      strategy: (input.strategy ?? 'standard') as 'standard' | 'squash' | 'no-ff',
    }),
  );
  registry.register('git.listConflicts', () => git.listConflicts());
  registry.register('tests.detect', () => tests.detect());
  registry.register('tests.run', (input) => tests.run({ command: String(input.command ?? '') }));
  return registry;
}

export type RegisteredPipelineState = Pick<PipelineRun, 'runId' | 'currentPhase'>;
