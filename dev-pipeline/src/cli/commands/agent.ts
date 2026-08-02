import path from 'node:path';
import { AgentRuntime } from '../../agent/runtime/agent-runtime.js';
import { PhaseAwarePlanner } from '../../agent/runtime/deterministic-planner.js';
import { PipelineController } from '../../agent/runtime/pipeline-controller.js';
import { JsonFileStateStore } from '../../agent/runtime/state-store.js';
import { RegistryToolExecutor } from '../../agent/runtime/tool-executor.js';
import { createLocalToolRegistry } from '../../agent/tools/registry.js';

export type AgentAction = 'status' | 'approve' | 'pause' | 'resume' | 'transition' | 'run';

export interface AgentCommandOptions {
  dir?: string;
  json?: boolean;
  reason?: string;
  actionId?: string;
  phase?: string;
  step?: string;
  maxSteps?: string;
}

function createController(dir: string): PipelineController {
  return new PipelineController(new JsonFileStateStore(path.resolve(dir)));
}

function printState(state: Awaited<ReturnType<PipelineController['status']>>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ status: 'ok', state }, null, 2));
    return;
  }
  console.log(`Agent run: ${state.changeName}`);
  console.log(`- status: ${state.status}`);
  console.log(`- phase: ${state.currentPhase}`);
  console.log(`- step: ${state.currentStep}`);
  if (state.pendingApproval) {
    console.log(
      `- pending approval: ${state.pendingApproval.actionId} (${state.pendingApproval.kind})`,
    );
  }
  if (state.pauseReason) console.log(`- pause reason: ${state.pauseReason}`);
}

export async function runAgentCommand(
  action: AgentAction,
  change: string,
  options: AgentCommandOptions = {},
): Promise<void> {
  const dir = options.dir ?? process.cwd();
  if (action === 'run') {
    const rootDir = path.resolve(dir);
    const stateStore = new JsonFileStateStore(rootDir);
    const runtime = new AgentRuntime({
      stateStore,
      planner: new PhaseAwarePlanner(),
      observer: { observe: async () => ({}) },
      executor: new RegistryToolExecutor(createLocalToolRegistry(rootDir)),
    });
    const result = await runtime.run(change, Number(options.maxSteps ?? 10));
    if (options.json) {
      console.log(JSON.stringify({ status: 'ok', result }, null, 2));
    } else {
      printState(result.state, false);
      console.log(`- run result: ${result.status}`);
      if ('action' in result && result.action) console.log(`- action: ${result.action.kind}`);
    }
    return;
  }
  const controller = createController(dir);
  let state: Awaited<ReturnType<PipelineController['status']>>;

  switch (action) {
    case 'status':
      state = await controller.status(change);
      break;
    case 'approve':
      if (!options.actionId) throw new Error('agent approve requires --action-id');
      state = await controller.approve(change, options.actionId);
      break;
    case 'pause':
      state = await controller.pause(change, options.reason ?? 'user-requested');
      break;
    case 'resume':
      state = await controller.resume(change);
      break;
    case 'transition': {
      const phase = Number(options.phase);
      const step = Number(options.step);
      if (!Number.isInteger(phase) || !Number.isInteger(step)) {
        throw new Error('agent transition requires integer --phase and --step');
      }
      state = await controller.transition(change, phase, step);
      break;
    }
  }

  printState(state, Boolean(options.json));
}
