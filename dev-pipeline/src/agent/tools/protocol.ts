import type { PipelineRun } from '../domain/pipeline-state.js';
import type { Evidence } from '../runtime/agent-runtime.js';

export interface ToolContext {
  run: PipelineRun;
  signal?: AbortSignal;
}

export interface ToolResponse<T = unknown> {
  status: 'succeeded' | 'blocked' | 'failed';
  summary: string;
  value?: T;
  evidence?: Evidence[];
}

export interface TypedTool<Input = unknown, Output = unknown> {
  readonly name: string;
  execute(input: Input, context: ToolContext): Promise<ToolResponse<Output>>;
}

export interface StateTools {
  get(input: { runId: string }): Promise<ToolResponse<PipelineRun | null>>;
  init(input: {
    runId: string;
    changeName: string;
    sourceBranch: string;
  }): Promise<ToolResponse<PipelineRun>>;
  recordDecision(input: {
    runId: string;
    key: string;
    value: unknown;
  }): Promise<ToolResponse<PipelineRun>>;
  transition(input: {
    runId: string;
    phase: number;
    step: number;
  }): Promise<ToolResponse<PipelineRun>>;
  pause(input: { runId: string; reason: string }): Promise<ToolResponse<PipelineRun>>;
  complete(input: { runId: string }): Promise<ToolResponse<PipelineRun>>;
}

export interface OpenSpecTools {
  preflight(input?: Record<string, never>): Promise<ToolResponse>;
  listChanges(input?: Record<string, never>): Promise<ToolResponse<unknown[]>>;
  createChange(input: { changeName: string }): Promise<ToolResponse>;
  status(input: { changeName: string }): Promise<ToolResponse>;
  instructions(input: { changeName: string; artifact?: string }): Promise<ToolResponse>;
  validate(input: { changeName: string }): Promise<ToolResponse>;
  apply(input: { changeName: string }): Promise<ToolResponse>;
  archive(input: { changeName: string }): Promise<ToolResponse>;
}

export interface GitTools {
  status(input?: Record<string, never>): Promise<ToolResponse>;
  diff(input?: { staged?: boolean }): Promise<ToolResponse>;
  branch(input?: Record<string, never>): Promise<ToolResponse<string>>;
  fetch(input?: { remote?: string; branch?: string }): Promise<ToolResponse>;
  stage(input: { paths: string[] }): Promise<ToolResponse>;
  commit(input: { message: string }): Promise<ToolResponse<{ sha: string }>>;
  push(input: { remote?: string; branch: string }): Promise<ToolResponse>;
  merge(input: {
    source: string;
    target: string;
    strategy: 'standard' | 'squash' | 'no-ff';
  }): Promise<ToolResponse>;
  listConflicts(input?: Record<string, never>): Promise<ToolResponse<string[]>>;
}

export interface TestTools {
  detect(input?: Record<string, never>): Promise<ToolResponse<string[]>>;
  run(input: { command: string }): Promise<ToolResponse>;
}
