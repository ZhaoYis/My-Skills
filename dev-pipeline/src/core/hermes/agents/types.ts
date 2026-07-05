import type {
  DecisionRecord,
  HermesState,
  PipelinePhase,
  SkillMemoryEntry,
} from '../types.js';

// ── Agent Context ──

/**
 * Context passed to every Agent when it executes.
 * Contains the full runtime state, relevant decisions, skill memories,
 * and any options the user or orchestrator wants the agent to use.
 */
export interface AgentContext {
  /** Absolute path to the target project directory */
  targetDir: string;
  /** Current Hermes runtime state (may be null if not initialized) */
  state: HermesState | null;
  /** All relevant decisions for the current context */
  decisions: DecisionRecord[];
  /** All relevant skill memory entries */
  memories: SkillMemoryEntry[];
  /** Arbitrary options passed from CLI or orchestrator */
  options: Record<string, unknown>;
}

// ── Agent Result ──

/**
 * The structured result every Agent returns after execution.
 */
export interface AgentResult {
  /** Whether the agent considers its execution successful */
  success: boolean;
  /** Arbitrary output data produced by the agent */
  output: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Estimated or actual token usage */
  tokensUsed: number;
  /** Number of tool calls made during execution */
  toolCalls: number;
  /** Decisions made by this agent during execution */
  decisions: DecisionRecord[];
  /** If the agent wants to suggest a next phase transition */
  suggestedNextPhase?: PipelinePhase;
}

// ── Agent Handler ──

/**
 * The core execution function every Agent must implement.
 * Takes an AgentContext and returns an AgentResult.
 */
export type AgentHandler = (ctx: AgentContext) => Promise<AgentResult>;

// ── Agent Definition ──

/**
 * Describes a registered Agent — its identity, applicability,
 * and its execution handler.
 */
export interface AgentDefinition {
  /** Unique identifier (e.g. 'init', 'sync', 'doctor') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Description of what this agent does */
  description: string;
  /** Which pipeline phases this agent can operate in */
  phases: PipelinePhase[];
  /** Whether this is a CLI utility agent or a pipeline phase agent */
  category: 'cli' | 'pipeline';
  /** The execution function */
  handler: AgentHandler;
  /** Options that must be present in AgentContext.options */
  requiredOptions?: string[];
}

// ── Agent Execution Record ──

/**
 * Internal record of a single agent invocation,
 * stored within the orchestrator step result.
 */
export interface AgentExecutionRecord {
  /** The agent that was executed */
  agentId: string;
  /** The phase during which it ran */
  phase: PipelinePhase;
  /** When execution started */
  startedAt: string;
  /** When execution completed */
  completedAt: string;
  /** The result returned by the agent */
  result: AgentResult;
}

// ── Orchestrator Step Result ──

/**
 * The result of a single orchestrator step.
 */
export interface StepResult {
  /** The agent execution record */
  execution: AgentExecutionRecord;
  /** The new Hermes state after this step */
  newState: HermesState;
  /** Whether this was the last step (terminal phase reached) */
  isTerminal: boolean;
}

// ── Orchestrator Run Result ──

/**
 * The result of a full orchestrator run (from start to terminal).
 */
export interface RunResult {
  /** Total steps executed */
  totalSteps: number;
  /** All step results, in execution order */
  steps: StepResult[];
  /** Whether the run reached 'completed' (vs 'terminated') */
  completed: boolean;
  /** Summary message */
  summary: string;
}

// ── Agent Selection Strategy ──

/**
 * How the orchestrator should select among available agents.
 */
export type AgentSelectionStrategy =
  | 'first-available'    // Pick the first registered agent for the phase
  | 'best-success-rate'  // Pick based on skill memory successRate
  | 'explicit';          // User explicitly specified which agent to run

// ── Orchestrator Options ──

/**
 * Options for orchestrator execution.
 */
export interface OrchestratorOptions {
  /** Target directory */
  dir?: string;
  /** Start from a specific phase (overrides runtime state) */
  startPhase?: PipelinePhase;
  /** Run only a specific agent (single step) */
  agentId?: string;
  /** Selection strategy */
  strategy?: AgentSelectionStrategy;
  /** Run single step only */
  singleStep?: boolean;
  /** Max steps before stopping (safety limit) */
  maxSteps?: number;
  /** Skip interactive prompts */
  yes?: boolean;
}