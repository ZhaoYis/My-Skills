import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createInitialState,
  readHermesState,
  writeHermesState,
  updatePhase,
  appendAgentExecution,
  updateAgentExecution,
  updatePendingAction,
  incrementRecovery,
} from '../../src/core/hermes/runtime-state.js';
import type { AgentExecution, HermesState } from '../../src/core/hermes/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

describe('runtime-state', () => {
  describe('createInitialState', () => {
    it('creates a state with given changeId and branch', () => {
      const state = createInitialState('change-1', 'feature/foo');

      expect(state.sessionId).toBe('change-1');
      expect(state.changeId).toBe('change-1');
      expect(state.branch).toBe('feature/foo');
      expect(state.currentPhase).toBe('pre_pipeline');
      expect(state.agentExecutions).toEqual([]);
      expect(state.recoveryAttempts).toBe(0);
      expect(state.maxRepairLoops).toBe(3);
      expect(state.pendingAction.type).toBe('ready');
    });

    it('accepts optional deliveryMode', () => {
      const state = createInitialState('change-2', 'feature/bar', 'pr');

      expect(state.deliveryMode).toBe('pr');
    });

    it('sets startTime and lastActiveTime', () => {
      const state = createInitialState('change-3', 'feature/baz');

      expect(state.startTime).toBeTruthy();
      expect(state.lastActiveTime).toBeTruthy();
      expect(state.startTime).toBe(state.lastActiveTime);
    });
  });

  describe('readHermesState and writeHermesState', () => {
    it('returns null when no state file exists', async () => {
      const dir = await createTempDir('opsx-hermes-state-');
      const state = await readHermesState(dir);
      expect(state).toBeNull();
    });

    it('writes and reads state correctly', async () => {
      const dir = await createTempDir('opsx-hermes-state-');
      const original = createInitialState('change-write', 'feature/write');

      await writeHermesState(dir, original);
      const read = await readHermesState(dir);

      expect(read).not.toBeNull();
      expect(read!.sessionId).toBe('change-write');
      expect(read!.changeId).toBe('change-write');
      expect(read!.branch).toBe('feature/write');
      expect(read!.currentPhase).toBe('pre_pipeline');
    });
  });

  describe('updatePhase', () => {
    it('transitions to a new phase', () => {
      const state = createInitialState('change-4', 'feature/phase');
      const updated = updatePhase(state, 'phase1_propose');

      expect(updated.currentPhase).toBe('phase1_propose');
    });

    it('updates lastActiveTime on phase change', async () => {
      const state = createInitialState('change-5', 'feature/phase2');
      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = updatePhase(state, 'phase2_apply');

      expect(updated.lastActiveTime).not.toBe(state.lastActiveTime);
    });

    it('does not mutate the original state', () => {
      const state = createInitialState('change-6', 'feature/immutable');
      updatePhase(state, 'phase3_review');

      expect(state.currentPhase).toBe('pre_pipeline');
    });
  });

  describe('appendAgentExecution', () => {
    it('adds an execution to the state', () => {
      const state = createInitialState('change-7', 'feature/agent');
      const exec: AgentExecution = {
        agentId: 'agent-1',
        task: 'Build auth module',
        phase: 'phase2_apply',
        status: 'running',
        result: 'unknown',
        tokensUsed: 0,
        toolCalls: 0,
        startedAt: new Date().toISOString(),
      };

      const updated = appendAgentExecution(state, exec);
      expect(updated.agentExecutions).toHaveLength(1);
      expect(updated.agentExecutions[0]!.agentId).toBe('agent-1');
    });

    it('appends multiple executions in order', () => {
      let state = createInitialState('change-8', 'feature/agents');
      const exec1: AgentExecution = {
        agentId: 'agent-1',
        task: 'Task 1',
        phase: 'phase1_propose',
        status: 'done',
        result: 'success',
        tokensUsed: 1000,
        toolCalls: 5,
        startedAt: new Date().toISOString(),
      };
      const exec2: AgentExecution = {
        agentId: 'agent-2',
        task: 'Task 2',
        phase: 'phase2_apply',
        status: 'done',
        result: 'success',
        tokensUsed: 2000,
        toolCalls: 10,
        startedAt: new Date().toISOString(),
      };

      state = appendAgentExecution(state, exec1);
      state = appendAgentExecution(state, exec2);

      expect(state.agentExecutions).toHaveLength(2);
      expect(state.agentExecutions[0]!.agentId).toBe('agent-1');
      expect(state.agentExecutions[1]!.agentId).toBe('agent-2');
    });
  });

  describe('updateAgentExecution', () => {
    it('updates an existing execution by agentId', () => {
      let state = createInitialState('change-9', 'feature/update');
      const exec: AgentExecution = {
        agentId: 'agent-update',
        task: 'Test task',
        phase: 'phase2_apply',
        status: 'running',
        result: 'unknown',
        tokensUsed: 500,
        toolCalls: 3,
        startedAt: new Date().toISOString(),
      };
      state = appendAgentExecution(state, exec);

      const updated = updateAgentExecution(state, 'agent-update', {
        status: 'done',
        result: 'success',
        tokensUsed: 1500,
        completedAt: new Date().toISOString(),
      });

      const found = updated.agentExecutions.find(
        (e) => e.agentId === 'agent-update',
      );
      expect(found).toBeDefined();
      expect(found!.status).toBe('done');
      expect(found!.result).toBe('success');
      expect(found!.tokensUsed).toBe(1500);
      expect(found!.toolCalls).toBe(3); // unchanged
    });

    it('does not affect other executions', () => {
      let state = createInitialState('change-10', 'feature/selective');
      state = appendAgentExecution(state, {
        agentId: 'a1',
        task: 'Task 1',
        phase: 'phase1_propose',
        status: 'done',
        result: 'success',
        tokensUsed: 100,
        toolCalls: 1,
        startedAt: new Date().toISOString(),
      });
      state = appendAgentExecution(state, {
        agentId: 'a2',
        task: 'Task 2',
        phase: 'phase2_apply',
        status: 'running',
        result: 'unknown',
        tokensUsed: 200,
        toolCalls: 2,
        startedAt: new Date().toISOString(),
      });

      const updated = updateAgentExecution(state, 'a1', { status: 'failed' });
      expect(
        updated.agentExecutions.find((e) => e.agentId === 'a1')!.status,
      ).toBe('failed');
      expect(
        updated.agentExecutions.find((e) => e.agentId === 'a2')!.status,
      ).toBe('running');
    });
  });

  describe('updatePendingAction', () => {
    it('updates the pending action', () => {
      const state = createInitialState('change-11', 'feature/pending');
      const updated = updatePendingAction(state, {
        type: 'wait_user',
        detail: '请确认提案后继续',
      });

      expect(updated.pendingAction.type).toBe('wait_user');
      expect(updated.pendingAction.detail).toBe('请确认提案后继续');
    });
  });

  describe('incrementRecovery', () => {
    it('increments recovery attempts', () => {
      const state = createInitialState('change-12', 'feature/recovery');
      expect(state.recoveryAttempts).toBe(0);

      const updated = incrementRecovery(state);
      expect(updated.recoveryAttempts).toBe(1);

      const updated2 = incrementRecovery(updated);
      expect(updated2.recoveryAttempts).toBe(2);
    });
  });
});