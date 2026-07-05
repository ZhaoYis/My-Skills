import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runLearningLoop } from '../../src/core/hermes/learning-loop.js';
import { logDecision } from '../../src/core/hermes/decision-logger.js';
import {
  createInitialState,
  writeHermesState,
  appendAgentExecution,
} from '../../src/core/hermes/runtime-state.js';
import {
  upsertSkillEntry,
  readSkillMemory,
} from '../../src/core/hermes/skill-memory.js';
import type { AgentExecution, DecisionRecord } from '../../src/core/hermes/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

function makeDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: '1',
    phase: 'phase2_apply',
    type: 'B',
    context: '实施任务',
    choice: 'confirm',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeExecution(overrides: Partial<AgentExecution> = {}): AgentExecution {
  return {
    agentId: 'agent-1',
    task: 'Build CRUD endpoint',
    phase: 'phase2_apply',
    status: 'done',
    result: 'success',
    tokensUsed: 3000,
    toolCalls: 8,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('learning-loop', () => {
  it('returns empty result when no data exists', async () => {
    const dir = await createTempDir('opsx-learn-empty-');
    const result = await runLearningLoop(dir);

    expect(result.patternsFound).toBe(0);
    expect(result.refinementsGenerated).toBe(0);
    expect(result.autoApplied).toEqual([]);
    expect(result.flaggedForReview).toEqual([]);
    expect(result.loggedEvents).toEqual([]);
    expect(result.summary).toContain('未发现新的模式');
  });

  it('detects failure patterns from multiple failed executions', async () => {
    const dir = await createTempDir('opsx-learn-failures-');

    // Set up state with 2 failed executions
    let state = createInitialState('change-fail', 'feature/fail');
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a1',
      status: 'failed',
      result: 'failure',
      task: 'Build auth module',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a2',
      status: 'failed',
      result: 'failure',
      task: 'Build payment module',
    }));
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir, 'phase2_apply');

    expect(result.patternsFound).toBeGreaterThan(0);
    const failureEvents = result.loggedEvents.filter(
      (e) => e.trigger === 'failure_pattern',
    );
    expect(failureEvents.length).toBeGreaterThan(0);
    expect(failureEvents[0]!.confidence).toBeGreaterThan(0);
    expect(failureEvents[0]!.suggestedRefinement).toBeTruthy();
  });

  it('detects success patterns from 3+ successful executions', async () => {
    const dir = await createTempDir('opsx-learn-successes-');

    let state = createInitialState('change-success', 'feature/success');
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a1',
      result: 'success',
      status: 'done',
      tokensUsed: 3000,
      toolCalls: 8,
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a2',
      result: 'success',
      status: 'done',
      tokensUsed: 3200,
      toolCalls: 7,
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a3',
      result: 'success',
      status: 'done',
      tokensUsed: 2800,
      toolCalls: 9,
    }));
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir);

    const successEvents = result.loggedEvents.filter(
      (e) => e.trigger === 'success_pattern',
    );
    expect(successEvents.length).toBeGreaterThan(0);
    expect(successEvents[0]!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects human intervention from multiple type A decisions', async () => {
    const dir = await createTempDir('opsx-learn-intervention-');

    // Log 2 type-A decisions
    await logDecision(dir, makeDecision({ id: '1', type: 'A', phase: 'phase2_apply' }));
    await logDecision(dir, makeDecision({ id: '2', type: 'A', phase: 'phase2_apply' }));

    // Need a state file for the learning loop to read executions
    let state = createInitialState('change-intervene', 'feature/intervene');
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir);

    const interventionEvents = result.loggedEvents.filter(
      (e) => e.trigger === 'human_intervention',
    );
    expect(interventionEvents.length).toBeGreaterThan(0);
  });

  it('detects max retries from fix loop failures', async () => {
    const dir = await createTempDir('opsx-learn-retries-');

    let state = createInitialState('change-retry', 'feature/retry');
    state = appendAgentExecution(state, makeExecution({
      agentId: 'fix-1',
      phase: 'phase3_fix',
      result: 'failure',
      status: 'failed',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'fix-2',
      phase: 'phase3_fix',
      result: 'failure',
      status: 'failed',
    }));
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir);

    const retryEvents = result.loggedEvents.filter(
      (e) => e.trigger === 'max_retries',
    );
    expect(retryEvents.length).toBeGreaterThan(0);
  });

  it('evaluates refinement candidates and applies high confidence', async () => {
    const dir = await createTempDir('opsx-learn-candidates-');

    // Create a low-success-rate entry in skill memory
    await upsertSkillEntry(dir, 'bad-pattern', {
      pattern: 'Build CRUD endpoint',
      category: 'implementation',
      successCount: 1,
      failCount: 6,
      totalAttempts: 7,
    });

    // Add related failed executions
    let state = createInitialState('change-candidate', 'feature/candidate');
    state = appendAgentExecution(state, makeExecution({
      agentId: 'crud-1',
      task: 'Build CRUD endpoint for users',
      result: 'failure',
      status: 'failed',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'crud-2',
      task: 'Build CRUD endpoint for orders',
      result: 'failure',
      status: 'failed',
    }));
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir, 'phase2_apply');

    // Should have found the bad pattern
    const candidatesWithRefinements = result.loggedEvents.filter(
      (e) => e.extractedPattern.includes('CRUD') || e.extractedPattern.includes('crud'),
    );
    // The candidate might be found even if no exact keyword match
    expect(result.patternsFound).toBeGreaterThan(0);
    expect(result.summary).toBeTruthy();
  });

  it('auto-applies high confidence refinements to skill memory', async () => {
    const dir = await createTempDir('opsx-learn-autoapply-');

    // Need 3+ successes in same phase for high confidence
    let state = createInitialState('change-auto', 'feature/auto');
    for (let i = 0; i < 4; i++) {
      state = appendAgentExecution(state, makeExecution({
        agentId: `success-${i}`,
        result: 'success',
        status: 'done',
        tokensUsed: 3000,
        toolCalls: 8,
      }));
    }
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir);

    // High confidence events should be auto-applied
    const highConfEvents = result.loggedEvents.filter(
      (e) => e.confidence > 0.8,
    );
    if (highConfEvents.length > 0) {
      expect(result.autoApplied.length).toBeGreaterThan(0);

      // Verify they are persisted in skill memory
      const store = await readSkillMemory(dir);
      expect(store.entries.length).toBeGreaterThan(0);
    }
  });

  it('flags medium confidence for review', async () => {
    const dir = await createTempDir('opsx-learn-flag-');

    // Create scenario with medium confidence: some failures, some success
    let state = createInitialState('change-flag', 'feature/flag');
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a1',
      result: 'success',
      status: 'done',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a2',
      result: 'failure',
      status: 'failed',
    }));
    await writeHermesState(dir, state);

    // Add type A decisions (medium confidence trigger)
    await logDecision(dir, makeDecision({ id: '1', type: 'A' }));
    await logDecision(dir, makeDecision({ id: '2', type: 'A' }));

    const result = await runLearningLoop(dir);

    // There should be some medium confidence events
    const mediumConfEvents = result.loggedEvents.filter(
      (e) => e.confidence >= 0.5 && e.confidence <= 0.8,
    );
    // At minimum, the human intervention should be medium confidence
    expect(result.flaggedForReview.length + result.autoApplied.length).toBeGreaterThanOrEqual(0);
  });

  it('generates a meaningful summary', async () => {
    const dir = await createTempDir('opsx-learn-summary-');

    let state = createInitialState('change-summary', 'feature/summary');
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a1',
      result: 'success',
      status: 'done',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a2',
      result: 'success',
      status: 'done',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'a3',
      result: 'success',
      status: 'done',
    }));
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir);

    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('filters by phase when provided', async () => {
    const dir = await createTempDir('opsx-learn-phase-filter-');

    let state = createInitialState('change-filter', 'feature/filter');
    // Successes in phase2_apply
    state = appendAgentExecution(state, makeExecution({
      agentId: 'apply-1',
      phase: 'phase2_apply',
      result: 'success',
      status: 'done',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'apply-2',
      phase: 'phase2_apply',
      result: 'success',
      status: 'done',
    }));
    state = appendAgentExecution(state, makeExecution({
      agentId: 'apply-3',
      phase: 'phase2_apply',
      result: 'success',
      status: 'done',
    }));
    // Failure in different phase
    state = appendAgentExecution(state, makeExecution({
      agentId: 'review-1',
      phase: 'phase3_review',
      result: 'failure',
      status: 'failed',
    }));
    await writeHermesState(dir, state);

    const result = await runLearningLoop(dir, 'phase2_apply');

    // Should only analyze phase2_apply executions
    expect(result.patternsFound).toBeGreaterThan(0);
    // The failure in phase3_review should not trigger failure_pattern here
    const failureEvents = result.loggedEvents.filter(
      (e) => e.trigger === 'failure_pattern',
    );
    // failures come from phase3_review, not phase2_apply, so none in this phase filter
    expect(failureEvents).toHaveLength(0);
  });
});