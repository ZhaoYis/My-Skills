import { readHermesState, writeHermesState, createInitialState, updatePhase, appendAgentExecution } from './runtime-state.js';
import { logDecision, readDecisions } from './decision-logger.js';
import { querySkillMemory, markExecution } from './skill-memory.js';
import { runLearningLoop } from './learning-loop.js';
import { getAllowedTransitions, validateTransition, isTerminal } from './state-machine.js';
import { AgentRegistry } from './agent-registry.js';
import { builtinAgents } from './agents/index.js';
import type { AgentDefinition, AgentResult } from './agents/types.js';
import type {
  AgentContext,
  AgentExecutionRecord,
  AgentSelectionStrategy,
  OrchestratorOptions,
  RunResult,
  StepResult,
} from './agents/types.js';
import type {
  HermesState,
  PipelinePhase,
  DecisionRecord,
  SkillMemoryEntry,
} from './types.js';

// ── Default Options ──

type ResolvedOrchestratorOptions = {
  dir: string;
  startPhase?: PipelinePhase;
  agentId?: string;
  strategy: AgentSelectionStrategy;
  singleStep: boolean;
  maxSteps: number;
  yes: boolean;
};

const DEFAULT_OPTIONS: ResolvedOrchestratorOptions = {
  dir: process.cwd(),
  strategy: 'best-success-rate',
  singleStep: false,
  maxSteps: 50,
  yes: false,
};

// ── Hermes Orchestrator ──

export class HermesOrchestrator {
  private registry: AgentRegistry;
  private targetDir: string;
  private options: ResolvedOrchestratorOptions;

  constructor(opts: OrchestratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...opts, dir: opts.dir ?? DEFAULT_OPTIONS.dir };
    this.targetDir = this.options.dir;
    this.registry = new AgentRegistry();
    this.registry.registerAll(builtinAgents);
  }

  /**
   * Get the agent registry.
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Run the full pipeline from current phase to terminal state.
   * Automatically advances through phases until completed or terminated.
   */
  async run(): Promise<RunResult> {
    const steps: StepResult[] = [];
    let currentState = await this.ensureState();

    // If a specific agent was requested, run only that one
    if (this.options.agentId) {
      const step = await this.step(currentState);
      steps.push(step);
      return {
        totalSteps: 1,
        steps,
        completed: step.isTerminal,
        summary: `Ran agent "${this.options.agentId}"`,
      };
    }

    // Run single step if requested
    if (this.options.singleStep) {
      const step = await this.step(currentState);
      steps.push(step);
      return {
        totalSteps: 1,
        steps,
        completed: step.isTerminal,
        summary: `Single step completed at phase "${currentState.currentPhase}"`,
      };
    }

    // Full pipeline run
    let stepCount = 0;
    while (!isTerminal(currentState.currentPhase) && stepCount < this.options.maxSteps) {
      const step = await this.step(currentState);
      steps.push(step);
      currentState = step.newState;
      stepCount++;

      if (step.isTerminal) break;
      if (!step.execution.result.success) {
        // On failure, decide whether to continue
        const willRetry = this.shouldRetry(currentState, step.execution.result);
        if (!willRetry) break;
      }
    }

    // Run learning loop at end
    try {
      await runLearningLoop(this.targetDir);
    } catch {
      // Learning failure is non-fatal
    }

    const completed = currentState.currentPhase === 'completed';
    return {
      totalSteps: steps.length,
      steps,
      completed,
      summary: completed
        ? `Pipeline completed successfully after ${steps.length} steps.`
        : `Pipeline stopped at phase "${currentState.currentPhase}" after ${steps.length} steps.`,
    };
  }

  /**
   * Execute a single step: select agent, run it, record, transition.
   */
  async step(state: HermesState): Promise<StepResult> {
    const phase = this.options.startPhase ?? state.currentPhase;

    // Get available agents for this phase
    const availableAgents = this.registry.getByPhase(phase);

    if (availableAgents.length === 0) {
      // No agents for this phase — auto-transition if possible
      const next = this.getDefaultTransition(phase);
      if (next && validateTransition(phase, next)) {
        const newState = updatePhase(state, next);
        await writeHermesState(this.targetDir, newState);

        return {
          execution: {
            agentId: 'auto-transition',
            phase,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            result: {
              success: true,
              output: { from: phase, to: next },
              tokensUsed: 0,
              toolCalls: 0,
              decisions: [],
            },
          },
          newState,
          isTerminal: isTerminal(next),
        };
      }

      // Terminal — nothing to do
      return {
        execution: {
          agentId: 'no-agent',
          phase,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: {
            success: true,
            output: { message: `No agents available for phase "${phase}"` },
            tokensUsed: 0,
            toolCalls: 0,
            decisions: [],
          },
        },
        newState: state,
        isTerminal: isTerminal(phase),
      };
    }

    // Select the best agent
    const agent = await this.selectAgent(availableAgents, phase);

    // Build context
    const ctx = await this.buildContext(state, phase);

    // Execute
    const result = await this.executeAgent(agent, ctx, state);

    // Determine next phase
    const nextPhase = result.suggestedNextPhase ?? this.getDefaultTransition(phase);
    let newState = state;

    if (nextPhase && validateTransition(phase, nextPhase)) {
      newState = updatePhase(state, nextPhase);
    }

    // Record agent execution
    const execRecord: AgentExecutionRecord = {
      agentId: agent.id,
      phase,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result,
    };

    newState = appendAgentExecution(newState, {
      agentId: agent.id,
      task: agent.name,
      phase,
      status: result.success ? 'done' : 'failed',
      result: result.success ? 'success' : 'failure',
      tokensUsed: result.tokensUsed,
      toolCalls: result.toolCalls,
      startedAt: execRecord.startedAt,
      completedAt: execRecord.completedAt,
      error: result.error,
    });

    // Log decisions
    for (const decision of result.decisions) {
      try {
        await logDecision(this.targetDir, decision);
      } catch {
        // Non-fatal
      }
    }

    // Update skill memory
    try {
      await markExecution(this.targetDir, agent.id, result.success);
    } catch {
      // Non-fatal
    }

    // Persist state
    await writeHermesState(this.targetDir, newState);

    return {
      execution: execRecord,
      newState,
      isTerminal: isTerminal(newState.currentPhase),
    };
  }

  /**
   * Select the best agent from available ones based on strategy.
   */
  private async selectAgent(
    available: AgentDefinition[],
    phase: PipelinePhase,
  ): Promise<AgentDefinition> {
    // If user specified an agent, use that
    if (this.options.agentId) {
      const explicit = available.find((a) => a.id === this.options.agentId);
      if (explicit) return explicit;
    }

    if (available.length === 1) return available[0]!;

    // If strategy is 'first-available', return the first
    if (this.options.strategy === 'first-available') {
      return available[0]!;
    }

    // 'best-success-rate': pick based on skill memory
    try {
      const memories = await querySkillMemory(this.targetDir);
      let bestAgent = available[0]!;
      let bestScore = -1;

      for (const agent of available) {
        const agentMemory = memories.find((m: SkillMemoryEntry) => m.key === agent.id);
        const score = agentMemory?.successRate ?? 0.5; // Default: neutral
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }

      return bestAgent;
    } catch {
      return available[0]!;
    }
  }

  /**
   * Build the execution context for an agent.
   */
  private async buildContext(
    state: HermesState,
    phase: PipelinePhase,
  ): Promise<AgentContext> {
    let decisions: DecisionRecord[] = [];
    let memories: SkillMemoryEntry[] = [];

    try {
      decisions = await readDecisions(this.targetDir, { phase });
    } catch {
      // Empty decisions
    }

    try {
      const store = await querySkillMemory(this.targetDir);
      memories = store.filter((m: SkillMemoryEntry) =>
        m.category === phase || m.category.startsWith(phase),
      );
    } catch {
      // Empty memories
    }

    return {
      targetDir: this.targetDir,
      state,
      decisions,
      memories,
      options: this.options as unknown as Record<string, unknown>,
    };
  }

  /**
   * Execute a single agent and record the execution.
   */
  private async executeAgent(
    agent: AgentDefinition,
    ctx: AgentContext,
    _state: HermesState,
  ): Promise<AgentResult> {
    try {
      return await agent.handler(ctx);
    } catch (error: unknown) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        tokensUsed: 0,
        toolCalls: 0,
        decisions: [],
      };
    }
  }

  /**
   * Get the default transition from a phase (first non-terminal option).
   */
  private getDefaultTransition(phase: PipelinePhase): PipelinePhase | undefined {
    const allowed = getAllowedTransitions(phase);
    return (allowed as PipelinePhase[]).find((t: PipelinePhase) => !isTerminal(t)) ?? allowed[0];
  }

  /**
   * Decide whether to retry after a failure.
   */
  private shouldRetry(state: HermesState, result: AgentResult): boolean {
    if (result.success) return true;
    // Don't retry if max repair loops exceeded
    if (state.recoveryAttempts >= state.maxRepairLoops) return false;
    return true;
  }

  /**
   * Ensure a HermesState exists, creating one if needed.
   */
  private async ensureState(): Promise<HermesState> {
    let state = await readHermesState(this.targetDir);

    if (!state) {
      state = createInitialState('default-change', 'main');
      await writeHermesState(this.targetDir, state);
    }

    if (this.options.startPhase) {
      state = updatePhase(state, this.options.startPhase);
    }

    return state;
  }
}

// ── Standalone Functions (for use outside the class) ──

/**
 * Create a new orchestrator with the given options and run it.
 */
export async function runOrchestrator(
  opts: OrchestratorOptions = {},
): Promise<RunResult> {
  const orchestrator = new HermesOrchestrator(opts);
  return orchestrator.run();
}

/**
 * Run a single step with the given options.
 */
export async function runSingleStep(
  opts: OrchestratorOptions = {},
): Promise<StepResult> {
  const orchestrator = new HermesOrchestrator({ ...opts, singleStep: true });
  const state = await readHermesState(opts.dir ?? process.cwd());
  if (!state) {
    throw new Error('No Hermes runtime state found. Run init first.');
  }
  return orchestrator.step(state);
}