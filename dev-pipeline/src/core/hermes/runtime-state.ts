import fs from 'fs-extra';
import path from 'node:path';
import { HERMES_RUNTIME_FILE } from '../runtime/meta.js';
import type {
  AgentExecution,
  DecisionRecord,
  HermesState,
  LearningEvent,
  PendingAction,
  PipelinePhase,
  DeliveryMode,
} from './types.js';

// ── Read / Write ──

export async function readHermesState(
  targetDir: string,
): Promise<HermesState | null> {
  const filePath = path.join(targetDir, HERMES_RUNTIME_FILE);
  if (!(await fs.pathExists(filePath))) {
    return null;
  }
  return fs.readJson(filePath) as Promise<HermesState>;
}

export async function writeHermesState(
  targetDir: string,
  state: HermesState,
): Promise<void> {
  const filePath = path.join(targetDir, HERMES_RUNTIME_FILE);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, state, { spaces: 2 });
}

// ── Create Initial State ──

export function createInitialState(
  changeId: string,
  branch: string,
  deliveryMode: DeliveryMode = '',
): HermesState {
  const now = new Date().toISOString();
  return {
    sessionId: changeId,
    changeId,
    branch,
    currentPhase: 'pre_pipeline',
    startTime: now,
    lastActiveTime: now,
    deliveryMode,
    pendingAction: { type: 'ready', detail: '流水线开始执行' },
    recoveryAttempts: 0,
    maxRepairLoops: 3,
    agentExecutions: [],
  };
}

// ── Update Phase ──

export function updatePhase(
  state: HermesState,
  phase: PipelinePhase,
): HermesState {
  return {
    ...state,
    currentPhase: phase,
    lastActiveTime: new Date().toISOString(),
  };
}

// ── Append Decision ──

export function appendDecision(
  state: HermesState,
  decision: DecisionRecord,
): HermesState {
  // Decisions are stored separately via decision-logger; this updates lastActiveTime.
  return {
    ...state,
    lastActiveTime: new Date().toISOString(),
  };
}

// ── Append Agent Execution ──

export function appendAgentExecution(
  state: HermesState,
  execution: AgentExecution,
): HermesState {
  return {
    ...state,
    agentExecutions: [...state.agentExecutions, execution],
    lastActiveTime: new Date().toISOString(),
  };
}

// ── Update Agent Execution ──

export function updateAgentExecution(
  state: HermesState,
  agentId: string,
  updates: Partial<AgentExecution>,
): HermesState {
  return {
    ...state,
    agentExecutions: state.agentExecutions.map((exec) =>
      exec.agentId === agentId ? { ...exec, ...updates } : exec,
    ),
    lastActiveTime: new Date().toISOString(),
  };
}

// ── Append Learning Event ──

export function appendLearningEvent(
  state: HermesState,
  _event: LearningEvent,
): HermesState {
  return {
    ...state,
    lastActiveTime: new Date().toISOString(),
  };
}

// ── Update Pending Action ──

export function updatePendingAction(
  state: HermesState,
  pendingAction: PendingAction,
): HermesState {
  return {
    ...state,
    pendingAction,
    lastActiveTime: new Date().toISOString(),
  };
}

// ── Increment Recovery ──

export function incrementRecovery(state: HermesState): HermesState {
  return {
    ...state,
    recoveryAttempts: state.recoveryAttempts + 1,
    lastActiveTime: new Date().toISOString(),
  };
}