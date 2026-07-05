// ── Pipeline Phase ──

export type PipelinePhase =
  | 'pre_pipeline'
  | 'phase0_entrance'
  | 'phase1_propose'
  | 'phase2_apply'
  | 'phase3_review'
  | 'phase3_fix'
  | 'phase4_archive'
  | 'phase5_unittest'
  | 'phase6_push'
  | 'phase6_merge'
  | 'phase7_pr_created'
  | 'phase7_ci_pending'
  | 'phase7_ci_triage'
  | 'phase7_pr_merge'
  | 'completed'
  | 'terminated';

export const PIPELINE_PHASES: readonly PipelinePhase[] = [
  'pre_pipeline',
  'phase0_entrance',
  'phase1_propose',
  'phase2_apply',
  'phase3_review',
  'phase3_fix',
  'phase4_archive',
  'phase5_unittest',
  'phase6_push',
  'phase6_merge',
  'phase7_pr_created',
  'phase7_ci_pending',
  'phase7_ci_triage',
  'phase7_pr_merge',
  'completed',
  'terminated',
] as const;

// ── Delivery Mode ──

export type DeliveryMode = 'push_only' | 'local_merge' | 'pr' | '';

// ── Decision Types ──

export type DecisionType = 'A' | 'B' | 'C';

export type DecisionChoice = string;

export interface DecisionRecord {
  id: string;
  phase: PipelinePhase;
  type: DecisionType;
  context: string;
  choice: DecisionChoice;
  reason?: string;
  timestamp: string;
}

// ── Agent Execution ──

export type AgentExecutionStatus = 'running' | 'done' | 'failed' | 'cancelled';

export type AgentExecutionResult = 'success' | 'partial' | 'failure' | 'unknown';

export interface AgentExecution {
  agentId: string;
  task: string;
  phase: PipelinePhase;
  status: AgentExecutionStatus;
  result: AgentExecutionResult;
  tokensUsed: number;
  toolCalls: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ── Skill Memory ──

export interface SkillMemoryEntry {
  key: string;
  pattern: string;
  category: string;
  successCount: number;
  failCount: number;
  totalAttempts: number;
  successRate: number;
  lastUsedAt: string;
  lastRefinedAt: string;
  refinements: string[];
  metadata: Record<string, unknown>;
}

export interface SkillMemoryStore {
  entries: SkillMemoryEntry[];
}

// ── Learning Event ──

export type LearningTrigger =
  | 'failure_pattern'
  | 'human_intervention'
  | 'max_retries'
  | 'success_pattern';

export interface LearningEvent {
  trigger: LearningTrigger;
  sourcePhase: PipelinePhase;
  context: string;
  extractedPattern: string;
  suggestedRefinement: string;
  confidence: number;
  timestamp: string;
}

// ── Pending Action ──

export type PendingActionType =
  | 'ready'
  | 'wait_user'
  | 'wait_ci'
  | 'wait_deploy'
  | 'wait_fix';

export interface PendingAction {
  type: PendingActionType;
  detail: string;
  since?: string;
}

// ── Decisions Log Store ──

export interface DecisionsLogStore {
  decisions: DecisionRecord[];
}

// ── Learning Result ──

export interface LearningResult {
  patternsFound: number;
  refinementsGenerated: number;
  autoApplied: SkillMemoryEntry[];
  flaggedForReview: SkillMemoryEntry[];
  loggedEvents: LearningEvent[];
  summary: string;
}

// ── Hermes Runtime State ──

export interface HermesState {
  sessionId: string;
  changeId: string;
  branch: string;
  currentPhase: PipelinePhase;
  startTime: string;
  lastActiveTime: string;
  deliveryMode: DeliveryMode;
  pendingAction: PendingAction;
  recoveryAttempts: number;
  maxRepairLoops: number;
  agentExecutions: AgentExecution[];
}

// ── Decide Response ──

export interface SimilarDecision {
  decision: DecisionRecord;
  relevance: number;
}

export interface RelevantMemory {
  entry: SkillMemoryEntry;
  relevance: number;
}

export interface DecideResult {
  pointId: string;
  similarDecisions: SimilarDecision[];
  relevantMemories: RelevantMemory[];
  recommendedChoice?: string;
  rationale: string;
}

// ── Hermes Status ──

export interface HermesSummary {
  sessionId: string;
  changeId: string;
  currentPhase: PipelinePhase;
  startTime: string;
  lastActiveTime: string;
  deliveryMode: DeliveryMode;
  pendingAction: PendingAction;
  agentCount: number;
  completedAgents: number;
  failedAgents: number;
  totalTokens: number;
  skillMemoryCount: number;
  decisionCount: number;
}