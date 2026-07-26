import type {
  ScenarioConfig,
  AgentPhaseResult,
  PipelineReport,
  PhaseId,
  TestEnvironment,
} from './types.js';
import { PHASE_META } from './types.js';
import { AgentPhaseRunner, getPhaseSpecificInstructions } from './AgentPhaseRunner.js';
import { createTestEnvironment } from './EnvironmentFactory.js';
import { formatLocalTime } from '../utils/date-time.js';

export interface AgentExecutionResult {
  status: AgentPhaseResult['status'];
  summary: string;
  assertions?: AgentPhaseResult['assertions'];
  artifacts?: AgentPhaseResult['artifacts'];
  errors?: string[];
  phaseData?: Record<string, unknown>;
}

export type AgentExecutor = (
  phaseId: PhaseId,
  prompt: string,
  env: TestEnvironment,
  scenario: ScenarioConfig,
) => Promise<AgentExecutionResult>;

export function normalizePhaseResult(result: AgentPhaseResult): AgentPhaseResult {
  if (result.status !== 'pass' || result.assertions.every((assertion) => assertion.passed)) {
    return result;
  }

  return {
    ...result,
    status: 'fail',
    errors: [...(result.errors ?? []), 'One or more required assertions failed.'],
  };
}

/**
 * Orchestrates the full pipeline delivery flow test.
 * Creates the test environment, runs each phase via an injected Agent executor,
 * validates outputs, and generates a structured report.
 */
export class PipelineAgentOrchestrator {
  private scenario: ScenarioConfig;
  private env!: TestEnvironment;
  private runner!: AgentPhaseRunner;
  private results: Map<PhaseId, AgentPhaseResult> = new Map();
  private startTime: number = 0;
  private agentExecutor?: AgentExecutor;

  constructor(scenario: ScenarioConfig, agentExecutor?: AgentExecutor) {
    this.scenario = scenario;
    this.agentExecutor = agentExecutor;
  }

  /**
   * Run the complete delivery flow.
   */
  async runFullFlow(): Promise<PipelineReport> {
    this.startTime = Date.now();

    // 1. Create test environment
    this.env = await createTestEnvironment({
      sampleProject: this.scenario.sampleProject,
      toolId: this.scenario.toolId,
      features: this.scenario.features,
      changeName: this.scenario.changeName,
      openspecMode: this.scenario.openspecMode,
    });

    this.runner = new AgentPhaseRunner(this.env);

    // 2. Run each phase in order
    const phaseResults: AgentPhaseResult[] = [];

    for (const phaseId of this.scenario.phases) {
      const result = await this.executeAgentPhase(phaseId);
      phaseResults.push(result);
      this.results.set(phaseId, result);
      this.runner.recordResult(result);

      // If a phase fails, stop and mark the remaining phases as skipped.
      if (result.status === 'fail' || result.status === 'error') {
        // Mark remaining phases as skipped
        const remainingPhases = this.scenario.phases.slice(
          this.scenario.phases.indexOf(phaseId) + 1,
        );
        for (const skippedId of remainingPhases) {
          const skippedResult = this.createSkippedResult(skippedId, `Phase${phaseId} failed`);
          phaseResults.push(skippedResult);
          this.results.set(skippedId, skippedResult);
        }
        break;
      }
    }

    // 3. Build the report
    const duration = Date.now() - this.startTime;
    return this.buildReport(phaseResults, duration);
  }

  /**
   * Execute a single phase via the injected Agent executor.
   */
  private async executeAgentPhase(phaseId: PhaseId): Promise<AgentPhaseResult> {
    const meta = PHASE_META[phaseId];
    const startTime = Date.now();

    // Build the agent prompt
    const basePrompt = this.runner.buildPhasePrompt(
      phaseId,
      this.scenario.changeName,
      this.scenario.featureDescription,
    );

    const specificInstructions = getPhaseSpecificInstructions(phaseId, {
      changeName: this.scenario.changeName,
      featureDescription: this.scenario.featureDescription,
      projectRoot: this.env.rootDir,
      skillRoot: this.env.skillRoot,
    });

    const fullPrompt = `${basePrompt}\n\n${specificInstructions}`;

    try {
      // Launch the AI Agent to execute this phase
      // The agent should return a structured JSON result
      const agentResult = await this.launchAgent(phaseId, fullPrompt);

      const duration = Date.now() - startTime;

      return normalizePhaseResult({
        phaseId,
        label: meta.label,
        status: agentResult.status as AgentPhaseResult['status'],
        startedAt: formatLocalTime(new Date(startTime)),
        durationMs: duration,
        agentSummary: agentResult.summary || 'Agent completed the phase',
        assertions: agentResult.assertions || [],
        artifacts: agentResult.artifacts || [],
        errors: agentResult.errors,
        phaseData: agentResult.phaseData,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        phaseId,
        label: meta.label,
        status: 'error',
        startedAt: formatLocalTime(new Date(startTime)),
        durationMs: duration,
        agentSummary: `Agent execution failed: ${String(error)}`,
        assertions: [],
        artifacts: [],
        errors: [String(error)],
      };
    }
  }

  private async launchAgent(phaseId: PhaseId, prompt: string): Promise<AgentExecutionResult> {
    if (!this.agentExecutor) {
      throw new Error('No Agent executor configured; refusing to report a synthetic pass.');
    }

    return this.agentExecutor(phaseId, prompt, this.env, this.scenario);
  }

  /**
   * Get the full prompt for an agent phase (exposed for test files).
   */
  getAgentPrompt(phaseId: PhaseId): string {
    const basePrompt = this.runner.buildPhasePrompt(
      phaseId,
      this.scenario.changeName,
      this.scenario.featureDescription,
    );
    const specificInstructions = getPhaseSpecificInstructions(phaseId, {
      changeName: this.scenario.changeName,
      featureDescription: this.scenario.featureDescription,
      projectRoot: this.env.rootDir,
      skillRoot: this.env.skillRoot,
    });
    return `${basePrompt}\n\n${specificInstructions}`;
  }

  /**
   * Initialize the environment (call before getAgentPrompt).
   */
  async init(): Promise<TestEnvironment> {
    this.env = await createTestEnvironment({
      sampleProject: this.scenario.sampleProject,
      toolId: this.scenario.toolId,
      features: this.scenario.features,
      changeName: this.scenario.changeName,
      openspecMode: this.scenario.openspecMode,
    });
    this.runner = new AgentPhaseRunner(this.env);
    this.startTime = Date.now();
    return this.env;
  }

  getEnvironment(): TestEnvironment {
    if (!this.env) {
      throw new Error('Test environment has not been initialized.');
    }
    return this.env;
  }

  /**
   * Record a phase result (called by a test after execution completes).
   */
  recordPhaseResult(result: AgentPhaseResult): void {
    const normalized = normalizePhaseResult(result);
    this.results.set(normalized.phaseId, normalized);
    this.runner.recordResult(normalized);
  }

  /**
   * Build the final report from all collected results.
   */
  buildReport(phaseResults: AgentPhaseResult[], durationMs: number): PipelineReport {
    const normalizedResults = phaseResults.map(normalizePhaseResult);
    const passed = normalizedResults.filter((p) => p.status === 'pass').length;
    const failed = normalizedResults.filter(
      (p) => p.status === 'fail' || p.status === 'error',
    ).length;
    const skipped = normalizedResults.filter((p) => p.status === 'skipped').length;

    const totalAssertions = normalizedResults.reduce((sum, p) => sum + p.assertions.length, 0);
    const passedAssertions = normalizedResults.reduce(
      (sum, p) => sum + p.assertions.filter((a) => a.passed).length,
      0,
    );
    const failedAssertions = totalAssertions - passedAssertions;

    const overallScore =
      totalAssertions > 0
        ? Math.round((passedAssertions / totalAssertions) * 100)
        : passed > 0
          ? 100
          : 0;

    const recommendations: string[] = [];
    if (failed > 0) {
      recommendations.push(`${failed} phase(s) failed — review error details in the report`);
    }
    if (skipped > 0) {
      recommendations.push(`${skipped} phase(s) skipped — may indicate orchestration issues`);
    }
    for (const r of normalizedResults) {
      if (r.errors && r.errors.length > 0) {
        recommendations.push(`Phase"${r.label}" has ${r.errors.length} error(s)`);
      }
    }

    return {
      meta: {
        scenarioName: this.scenario.name,
        sampleProject: this.scenario.sampleProject,
        toolId: this.scenario.toolId,
        changeName: this.scenario.changeName,
        sourceBranch: this.env.sourceBranch,
        targetBranch: this.env.targetBranch,
        timestamp: formatLocalTime(),
        durationMs,
        overallStatus: failed > 0 ? 'fail' : skipped > 0 ? 'partial' : 'pass',
      },
      environment: {
        nodeVersion: process.version,
        openspecAvailable: this.env.openspecAvailable,
        openspecVersion: this.env.openspecVersion,
        openspecMode: this.env.openspecMode,
        pipelineInitResult: this.env.pipelineInitResult,
      },
      phases: normalizedResults,
      summary: {
        totalPhases: normalizedResults.length,
        passedPhases: passed,
        failedPhases: failed,
        skippedPhases: skipped,
        totalAssertions,
        passedAssertions,
        failedAssertions,
        overallScore,
        recommendations,
      },
    };
  }

  private createSkippedResult(phaseId: PhaseId, reason: string): AgentPhaseResult {
    const meta = PHASE_META[phaseId];
    return {
      phaseId,
      label: meta.label,
      status: 'skipped',
      startedAt: formatLocalTime(),
      durationMs: 0,
      agentSummary: `Skipped: ${reason}`,
      assertions: [],
      artifacts: [],
    };
  }
}
