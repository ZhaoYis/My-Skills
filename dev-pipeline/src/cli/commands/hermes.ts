import pc from 'picocolors';
import {
  readHermesState,
  createInitialState,
  writeHermesState,
} from '../../core/hermes/runtime-state.js';
import {
  findSimilarDecisions,
  readDecisions,
} from '../../core/hermes/decision-logger.js';
import {
  querySkillMemory,
} from '../../core/hermes/skill-memory.js';
import { runLearningLoop } from '../../core/hermes/learning-loop.js';
import {
  getAllowedTransitions,
  getRecoveryBehavior,
  isTerminal,
} from '../../core/hermes/state-machine.js';
import { HermesOrchestrator } from '../../core/hermes/orchestrator.js';
import type {
  DecideResult,
  HermesState,
  LearningResult,
  PipelinePhase,
} from '../../core/hermes/types.js';
import type {
  AgentDefinition,
  AgentSelectionStrategy,
  OrchestratorOptions,
  RunResult,
  StepResult,
} from '../../core/hermes/agents/types.js';

// ── Entry Point ──

export interface HermesCommandOptions {
  dir?: string;
  json?: boolean;
  phase?: string;
  category?: string;
  /** When running a specific agent */
  agentId?: string;
  /** Dry run mode for agents */
  dryRun?: boolean;
  /** Run single step */
  singleStep?: boolean;
  /** Auto-confirm */
  yes?: boolean;
  /** Force mode */
  force?: boolean;
  /** Strategy for agent selection */
  strategy?: string;
}

export async function runHermesCommand(
  action: string,
  options: HermesCommandOptions,
): Promise<void> {
  const dir = options.dir ?? process.cwd();

  switch (action) {
    case 'status':
      await showStatus(dir, Boolean(options.json));
      break;
    case 'decide':
      await runDecide(dir, Boolean(options.json));
      break;
    case 'learn':
      await runLearn(dir, Boolean(options.json), options.phase as PipelinePhase | undefined);
      break;
    case 'memory':
      await showMemory(dir, Boolean(options.json), options.category);
      break;
    case 'run':
      await runOrchestrate(dir, options);
      break;
    case 'agent':
      await runSingleAgent(dir, options);
      break;
    case 'agents':
      await listAgents();
      break;

    default:
      console.error(pc.red(`Unknown hermes action: ${action}`));
      console.error(pc.dim('Available actions: status, decide, learn, memory, run, agent, agents'));
      process.exitCode = 1;
  }
}

// ── Status ──

async function showStatus(dir: string, json: boolean): Promise<void> {
  const state = await readHermesState(dir);

  if (!state) {
    if (json) {
      console.log(JSON.stringify({ error: 'No Hermes runtime state found' }));
    } else {
      console.log(pc.yellow('No Hermes runtime state found in this directory.'));
      console.log(pc.dim('Use "opsx-dev-pipeline hermes status" within a pipeline-managed project.'));
    }
    return;
  }

  if (json) {
    const summary = buildStatusSummary(state);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printStatusHuman(state);
}

function buildStatusSummary(state: HermesState) {
  const completed = state.agentExecutions.filter((e) => e.status === 'done').length;
  const failed = state.agentExecutions.filter((e) => e.status === 'failed').length;

  return {
    sessionId: state.sessionId,
    changeId: state.changeId,
    currentPhase: state.currentPhase,
    startTime: state.startTime,
    lastActiveTime: state.lastActiveTime,
    deliveryMode: state.deliveryMode,
    pendingAction: state.pendingAction,
    agents: {
      total: state.agentExecutions.length,
      completed,
      failed,
      running: state.agentExecutions.length - completed - failed,
    },
    totalTokens: state.agentExecutions.reduce((s, e) => s + e.tokensUsed, 0),
    recoveryAttempts: state.recoveryAttempts,
    isTerminal: isTerminal(state.currentPhase),
    allowedTransitions: getAllowedTransitions(state.currentPhase),
  };
}

function printStatusHuman(state: HermesState): void {
  const phaseColor = isTerminal(state.currentPhase)
    ? pc.dim
    : state.currentPhase.startsWith('phase7')
      ? pc.cyan
      : pc.green;

  console.log(pc.bold('Hermes Runtime Status'));
  console.log('─────────────────────');
  console.log(`  Session:     ${pc.white(state.changeId)}`);
  console.log(`  Phase:       ${phaseColor(state.currentPhase)}`);
  console.log(`  Started:     ${formatTime(state.startTime)}`);
  console.log(`  Last Active: ${formatTime(state.lastActiveTime)}`);

  if (state.deliveryMode) {
    console.log(`  Delivery:    ${pc.magenta(state.deliveryMode)}`);
  }

  console.log(`  Action:      ${pc.yellow(state.pendingAction.type)} — ${state.pendingAction.detail}`);

  const completed = state.agentExecutions.filter((e) => e.status === 'done').length;
  const failed = state.agentExecutions.filter((e) => e.status === 'failed').length;
  const total = state.agentExecutions.length;

  if (total > 0) {
    const okPart = completed > 0 ? pc.green(`${completed} done`) : '';
    const failPart = failed > 0 ? pc.red(`${failed} failed`) : '';
    const runPart = total - completed - failed > 0
      ? pc.yellow(`${total - completed - failed} running`)
      : '';
    console.log(`  Agents:      ${[okPart, failPart, runPart].filter(Boolean).join(', ')} (${total} total)`);
  }

  if (state.recoveryAttempts > 0) {
    console.log(`  Recovery:    ${pc.yellow(`${state.recoveryAttempts} attempts`)}`);
  }

  // Allowed transitions
  const transitions = getAllowedTransitions(state.currentPhase);
  if (transitions.length > 0) {
    console.log(`  Next:        ${transitions.map((t) => pc.blue(t)).join(' | ')}`);
  }

  // Recovery info
  console.log(`  Resume:      ${pc.dim(getRecoveryBehavior(state.currentPhase))}`);

  // Agent execution list
  if (state.agentExecutions.length > 0) {
    console.log(`\n${pc.bold('Agent Executions:')}`);
    for (const exec of state.agentExecutions) {
      const icon =
        exec.result === 'success'
          ? pc.green('✓')
          : exec.result === 'failure'
            ? pc.red('✗')
            : pc.yellow('◌');
      console.log(
        `  ${icon} [${exec.phase}] ${exec.task} — ${exec.tokensUsed} tokens, ${exec.toolCalls} calls`,
      );
    }
  }
}

// ── Decide ──

async function runDecide(dir: string, json: boolean): Promise<void> {
  const state = await readHermesState(dir);

  if (!state) {
    console.log(pc.yellow('No Hermes runtime state found.'));
    return;
  }

  // Read recent decisions and skill memory for context
  const allDecisions = await readDecisions(dir);
  const allMemories = await querySkillMemory(dir);

  // For now, provide context for the current phase
  const phaseDecisions = allDecisions.filter(
    (d) => d.phase === state.currentPhase,
  );
  const similarDecisions = await findSimilarDecisions(
    dir,
    state.currentPhase,
    5,
  );

  // Match memories to current phase context
  const relevantMemories = allMemories.slice(0, 5);

  const result: DecideResult = {
    pointId: state.currentPhase,
    similarDecisions,
    relevantMemories: relevantMemories.map((m) => ({
      entry: m,
      relevance: 1.0,
    })),
    recommendedChoice: undefined,
    rationale: `当前处于 ${state.currentPhase} 阶段，历史上有 ${phaseDecisions.length} 条相关决策。`,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printDecideHuman(result);
}

function printDecideHuman(result: DecideResult): void {
  console.log(pc.bold(`Decision Context: ${result.pointId}`));
  console.log('──────────────────────────────────');
  console.log(pc.dim(result.rationale));

  if (result.recommendedChoice) {
    console.log(`\n${pc.green('Recommended:')} ${result.recommendedChoice}`);
  }

  if (result.similarDecisions.length > 0) {
    console.log(`\n${pc.bold('Similar Past Decisions:')}`);
    for (const { decision, relevance } of result.similarDecisions) {
      const relStr = `${Math.round(relevance * 100)}%`;
      console.log(
        `  [${pc.yellow(decision.type)}] ${decision.context}`,
      );
      console.log(
        `    → ${pc.green(decision.choice)} (${relStr} relevance)`,
      );
      if (decision.reason) {
        console.log(`    ${pc.dim(decision.reason)}`);
      }
    }
  }

  if (result.relevantMemories.length > 0) {
    console.log(`\n${pc.bold('Relevant Skill Memories:')}`);
    for (const { entry } of result.relevantMemories) {
      const rateStr =
        entry.successRate >= 0.7
          ? pc.green(`${Math.round(entry.successRate * 100)}%`)
          : pc.yellow(`${Math.round(entry.successRate * 100)}%`);
      console.log(`  [${entry.category}] ${entry.pattern} — success rate: ${rateStr}`);
    }
  }
}

// ── Learn ──

async function runLearn(
  dir: string,
  json: boolean,
  phase?: PipelinePhase,
): Promise<void> {
  console.log(pc.dim('Running Hermes learning loop...'));

  const result = await runLearningLoop(dir, phase);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printLearnHuman(result);
}

function printLearnHuman(result: LearningResult): void {
  console.log(pc.bold('\nHermes Learning Report'));
  console.log('──────────────────────');

  if (result.patternsFound === 0) {
    console.log(pc.dim('No new patterns discovered.'));
    return;
  }

  // Events by trigger
  const byTrigger = groupBy(result.loggedEvents, 'trigger');
  for (const [trigger, events] of Object.entries(byTrigger)) {
    const label = triggerLabel(trigger);
    console.log(`\n${pc.bold(label)} (${events.length}):`);
    for (const event of events) {
      const confStr =
        event.confidence > 0.8
          ? pc.green(`high (${Math.round(event.confidence * 100)}%)`)
          : event.confidence >= 0.5
            ? pc.yellow(`medium (${Math.round(event.confidence * 100)}%)`)
            : pc.red(`low (${Math.round(event.confidence * 100)}%)`);
      console.log(`  [${confStr}] ${event.suggestedRefinement}`);
    }
  }

  if (result.autoApplied.length > 0) {
    console.log(`\n${pc.green('Auto-Applied (high confidence):')}`);
    for (const entry of result.autoApplied) {
      console.log(`  ✓ ${entry.key}: ${entry.pattern}`);
    }
  }

  if (result.flaggedForReview.length > 0) {
    console.log(`\n${pc.yellow('Flagged for Review (medium confidence):')}`);
    for (const entry of result.flaggedForReview) {
      console.log(`  ⚠ ${entry.key}: ${entry.pattern}`);
    }
  }

  console.log(`\n${pc.dim(result.summary)}`);
}

// ── Memory ──

async function showMemory(
  dir: string,
  json: boolean,
  category?: string,
): Promise<void> {
  const entries = await querySkillMemory(dir, category ? { category } : undefined);

  if (json) {
    console.log(JSON.stringify({ entries }, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log(pc.dim('No skill memory entries found.'));
    return;
  }

  console.log(pc.bold(`Skill Memory (${entries.length} entries)`));
  if (category) {
    console.log(pc.dim(`Category: ${category}`));
  }
  console.log('────────────────────────────────────────────');

  for (const entry of entries) {
    const rateColor =
      entry.successRate >= 0.7
        ? pc.green
        : entry.successRate >= 0.4
          ? pc.yellow
          : pc.red;
    const rateStr = rateColor(`${Math.round(entry.successRate * 100)}%`);

    console.log(`\n${pc.bold(entry.key)} [${entry.category}]`);
    console.log(`  Pattern:     ${entry.pattern}`);
    console.log(`  Success:     ${rateStr} (${entry.successCount}/${entry.totalAttempts})`);
    console.log(`  Last Used:   ${formatTime(entry.lastUsedAt)}`);
    if (entry.refinements.length > 0) {
      console.log(`  Refinements: ${entry.refinements.join('; ')}`);
    }
  }
}

// ── Orchestrate (run) ──

async function runOrchestrate(
  dir: string,
  options: HermesCommandOptions,
): Promise<void> {
  const opts: OrchestratorOptions = {
    dir,
    startPhase: options.phase as PipelinePhase | undefined,
    agentId: options.agentId,
    singleStep: options.singleStep,
    yes: options.yes,
    strategy: options.strategy as AgentSelectionStrategy | undefined,
  };

  console.log(pc.bold('Hermes Orchestrator'));
  console.log(pc.dim('─────────────────'));

  if (options.singleStep) {
    console.log(pc.dim('Mode: single step'));
  } else if (options.agentId) {
    console.log(pc.dim(`Running specific agent: ${options.agentId}`));
  } else {
    console.log(pc.dim('Mode: full pipeline run'));
  }

  const orchestrator = new HermesOrchestrator(opts);

  if (options.json) {
    const result = await orchestrator.run();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output — stream steps
  if (options.singleStep || options.agentId) {
    const state = await readHermesState(dir);
    if (!state) {
      console.log(pc.red('No Hermes runtime state found.'));
      return;
    }
    const step = await (orchestrator as any).step(state) as StepResult;
    printStepHuman(step);
  } else {
    const result = await orchestrator.run();
    printRunResultHuman(result);
  }
}

// ── Run Single Agent ──

async function runSingleAgent(
  dir: string,
  options: HermesCommandOptions,
): Promise<void> {
  const agentId = options.agentId;
  if (!agentId) {
    console.error(pc.red('Missing agent ID. Usage: hermes agent <agent-id>'));
    process.exitCode = 1;
    return;
  }

  const orchestrator = new HermesOrchestrator({
    dir,
    agentId,
    yes: options.yes,
  });

  const result = await orchestrator.run();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printRunResultHuman(result);
  }
}

// ── List Agents ──

async function listAgents(): Promise<void> {
  const orchestrator = new HermesOrchestrator();
  const agents = orchestrator.getRegistry().getAll();

  console.log(pc.bold('Registered Hermes Agents'));
  console.log(pc.dim('──────────────────────'));

  const cliAgents = agents.filter((a: AgentDefinition) => a.category === 'cli');
  const pipelineAgents = agents.filter((a: AgentDefinition) => a.category === 'pipeline');

  console.log(`\n${pc.bold('CLI Utility Agents')} (${cliAgents.length}):`);
  for (const agent of cliAgents) {
    console.log(`  ${pc.green(agent.id)}: ${agent.name}`);
    console.log(`    ${pc.dim(agent.description)}`);
    console.log(`    Phases: ${agent.phases.join(', ')}`);
  }

  console.log(`\n${pc.bold('Pipeline Phase Agents')} (${pipelineAgents.length}):`);
  for (const agent of pipelineAgents) {
    console.log(`  ${pc.green(agent.id)}: ${agent.name}`);
    console.log(`    ${pc.dim(agent.description)}`);
    console.log(`    Phases: ${agent.phases.length} phases`);
  }
}

// ── Print Helpers ──

function printStepHuman(step: StepResult): void {
  const icon = step.execution.result.success ? pc.green('✓') : pc.red('✗');
  console.log(
    `\n  ${icon} [${step.execution.phase}] ${step.execution.agentId}`,
  );
  console.log(`    Result: ${JSON.stringify(step.execution.result.output)}`);
  if (step.execution.result.error) {
    console.log(`    Error: ${pc.red(step.execution.result.error)}`);
  }
  console.log(`    Next phase: ${pc.blue(step.newState.currentPhase)}`);
  if (step.isTerminal) {
    console.log(`    ${pc.dim('(terminal)')}`);
  }
}

function printRunResultHuman(result: RunResult): void {
  console.log(`\n${pc.bold('Run Summary')}`);
  console.log(pc.dim('───────────'));
  console.log(`  Steps:     ${result.totalSteps}`);
  console.log(
    `  Status:    ${result.completed ? pc.green('completed') : pc.yellow('incomplete')}`,
  );
  console.log(`  ${pc.dim(result.summary)}`);

  if (result.steps.length > 0) {
    console.log(`\n${pc.bold('Step Details:')}`);
    for (const step of result.steps) {
      const icon = step.execution.result.success ? pc.green('✓') : pc.red('✗');
      const decisions = step.execution.result.decisions.length;
      console.log(
        `  ${icon} [${step.execution.phase}] ${step.execution.agentId} — ${decisions} decisions, ${step.execution.result.toolCalls} tool calls`,
      );
      if (step.execution.result.error) {
        console.log(`    ${pc.red('Error:')} ${step.execution.result.error}`);
      }
    }
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case 'failure_pattern':
      return 'Failure Patterns';
    case 'human_intervention':
      return 'Human Intervention';
    case 'max_retries':
      return 'Max Retries';
    case 'success_pattern':
      return 'Success Patterns';
    default:
      return trigger;
  }
}

function groupBy<T>(
  items: T[],
  key: keyof T,
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key]);
    (result[k] ??= []).push(item);
  }
  return result;
}