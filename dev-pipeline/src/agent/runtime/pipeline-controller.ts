import { type PipelineRun, pauseRun, transitionRun } from '../domain/pipeline-state.js';
import type { StateStore } from './state-store.js';

export class PipelineController {
  constructor(
    private readonly stateStore: StateStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async status(runId: string): Promise<PipelineRun> {
    const state = await this.stateStore.load(runId);
    if (!state) throw new Error(`pipeline-run-not-found: ${runId}`);
    return state;
  }

  async approve(runId: string, actionId: string): Promise<PipelineRun> {
    const state = await this.status(runId);
    if (state.pendingApproval?.actionId !== actionId) {
      throw new Error(`approval-not-pending: ${actionId}`);
    }
    return this.stateStore.save(
      {
        ...state,
        approvedActions: Array.from(new Set([...(state.approvedActions ?? []), actionId])),
        pendingApproval: undefined,
        updatedAt: this.now(),
      },
      state._version,
    );
  }

  async pause(runId: string, reason: string): Promise<PipelineRun> {
    const state = await this.status(runId);
    return this.stateStore.save(pauseRun(state, reason, this.now()), state._version);
  }

  async resume(runId: string): Promise<PipelineRun> {
    const state = await this.status(runId);
    if (state.status !== 'paused') return state;
    return this.stateStore.save(
      { ...state, status: 'active', pauseReason: undefined, updatedAt: this.now() },
      state._version,
    );
  }

  async transition(runId: string, phase: number, step: number): Promise<PipelineRun> {
    const state = await this.status(runId);
    return this.stateStore.save(transitionRun(state, phase, step, this.now()), state._version);
  }
}
