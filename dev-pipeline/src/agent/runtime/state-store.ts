import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PipelineRun } from '../domain/pipeline-state.js';

export interface StateStore {
  load(runId: string): Promise<PipelineRun | null>;
  save(state: PipelineRun, expectedVersion?: number): Promise<PipelineRun>;
}

export class InMemoryStateStore implements StateStore {
  private readonly states = new Map<string, PipelineRun>();

  constructor(initial: PipelineRun[] = []) {
    for (const state of initial) this.states.set(state.runId, structuredClone(state));
  }

  async load(runId: string): Promise<PipelineRun | null> {
    const state = this.states.get(runId);
    return state ? structuredClone(state) : null;
  }

  async save(state: PipelineRun, expectedVersion?: number): Promise<PipelineRun> {
    const current = this.states.get(state.runId);
    if (expectedVersion !== undefined && current && current._version !== expectedVersion) {
      throw new Error('state-version-conflict');
    }
    const next = structuredClone(state);
    next._version = (current?._version ?? -1) + 1;
    this.states.set(state.runId, next);
    return structuredClone(next);
  }
}

export class JsonFileStateStore implements StateStore {
  constructor(private readonly rootDir: string) {}

  private filePath(runId: string): string {
    if (!/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/.test(runId)) {
      throw new Error('invalid-run-id');
    }
    return path.join(this.rootDir, 'openspec', '.pipeline-state', `${runId}.json`);
  }

  async load(runId: string): Promise<PipelineRun | null> {
    try {
      return JSON.parse(await readFile(this.filePath(runId), 'utf8')) as PipelineRun;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(state: PipelineRun, expectedVersion?: number): Promise<PipelineRun> {
    const file = this.filePath(state.runId);
    const current = await this.load(state.runId);
    if (expectedVersion !== undefined && current && current._version !== expectedVersion) {
      throw new Error('state-version-conflict');
    }
    const next = structuredClone(state);
    next._version = (current?._version ?? -1) + 1;
    next.updatedAt = new Date().toISOString();
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file);
    return next;
  }
}
