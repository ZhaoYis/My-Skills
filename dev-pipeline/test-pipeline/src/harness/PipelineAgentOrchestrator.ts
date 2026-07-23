import type {
  ScenarioConfig,
  AgentPhaseResult,
  PipelineReport,
  PhaseId,
  TestEnvironment,
} from './types.js';
import { ALL_PHASES, PHASE_META } from './types.js';
import { AgentPhaseRunner, getPhaseSpecificInstructions } from './AgentPhaseRunner.js';
import { createTestEnvironment } from './EnvironmentFactory.js';
import type { EnvironmentConfig } from './types.js';

/**
 * Orchestrates the full pipeline delivery flow test.
 * Creates the test environment, runs each Phasevia AI Agent,
 * validates outputs, and generates a structured report.
 */
export class PipelineAgentOrchestrator {
  private scenario: ScenarioConfig;
  private env!: TestEnvironment;
  private runner!: AgentPhaseRunner;
  private results: Map<PhaseId, AgentPhaseResult> = new Map();
  private startTime: number = 0;

  constructor(scenario: ScenarioConfig) {
    this.scenario = scenario;
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
      schemaConfig: this.scenario.schemaConfig,
      skipPipelineInit: this.scenario.skipPipelineInit,
    });

    this.runner = new AgentPhaseRunner(this.env);

    // 2. Run each Phasein order
    const phaseResults: AgentPhaseResult[] = [];

    for (const phaseId of this.scenario.phases) {
      const result = await this.executeAgentPhase(phaseId);
      phaseResults.push(result);
      this.results.set(phaseId, result);
      this.runner.recordResult(result);

      // If a Phasefails, decide whether to continue
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
   * Execute a single Phasevia AI Agent.
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
    });

    const fullPrompt = `${basePrompt}\n\n${specificInstructions}`;

    try {
      // Launch the AI Agent to execute this phase
      // The agent should return a structured JSON result
      const agentResult = await this.launchAgent(phaseId, fullPrompt);

      const duration = Date.now() - startTime;

      return {
        phaseId,
        label: meta.label,
        status: agentResult.status as AgentPhaseResult['status'],
        startedAt: new Date(startTime).toISOString(),
        durationMs: duration,
        agentSummary: agentResult.summary || 'Agent completed the phase',
        assertions: agentResult.assertions || [],
        artifacts: agentResult.artifacts || [],
        errors: agentResult.errors,
        phaseData: agentResult.phaseData,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        phaseId,
        label: meta.label,
        status: 'error',
        startedAt: new Date(startTime).toISOString(),
        durationMs: duration,
        agentSummary: `Agent execution failed: ${String(error)}`,
        assertions: [],
        artifacts: [],
        errors: [String(error)],
      };
    }
  }

  /**
   * Launch an AI agent to execute a pipeline phase.
   * This is a placeholder — in actual use, the test harness
   * calls the Claude Code Agent tool to spawn the agent.
   */
  private async launchAgent(
    phaseId: PhaseId,
    prompt: string,
  ): Promise<{
    status: string;
    summary: string;
    assertions?: Array<{ description: string; passed: boolean; detail?: string }>;
    artifacts?: Array<{ path: string; type: 'file' | 'directory'; exists: boolean; size?: number }>;
    errors?: string[];
    phaseData?: Record<string, unknown>;
  }> {
    // NOTE: This function is designed to be called via the Claude Code Agent tool.
    // In a vitest context, the test file calls Agent tool directly.
    // This class provides the prompt construction and result parsing.
    //
    // The actual agent invocation happens in the test scenario file:
    //   const result = await agent(prompt, { schema: PHASE_RESULT_SCHEMA });

    return {
      status: 'pass',
      summary: `Phase${phaseId} completed. Agent would execute the prompt above.`,
    };
  }

  /**
   * Get the full prompt for an agent Phase(exposed for test files).
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
      schemaConfig: this.scenario.schemaConfig,
      skipPipelineInit: this.scenario.skipPipelineInit,
    });
    this.runner = new AgentPhaseRunner(this.env);
    this.startTime = Date.now();
    return this.env;
  }

  /**
   * Record a Phaseresult (called by test after agent completes).
   */
  recordPhaseResult(result: AgentPhaseResult): void {
    this.results.set(result.phaseId, result);
    this.runner.recordResult(result);
  }

  /**
   * Build the final report from all collected results.
   */
  buildReport(phaseResults: AgentPhaseResult[], durationMs: number): PipelineReport {
    const passed = phaseResults.filter((p) => p.status === 'pass').length;
    const failed = phaseResults.filter((p) => p.status === 'fail' || p.status === 'error').length;
    const skipped = phaseResults.filter((p) => p.status === 'skipped').length;

    const totalAssertions = phaseResults.reduce((sum, p) => sum + p.assertions.length, 0);
    const passedAssertions = phaseResults.reduce(
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
    for (const r of phaseResults) {
      if (r.errors && r.errors.length > 0) {
        recommendations.push(`Phase"${r.label}" has ${r.errors.length} error(s)`);
      }
    }

    return {
      meta: {
        scenarioName: this.scenario.name,
        sampleProject: this.scenario.sampleProject,
        toolId: this.scenario.toolId,
        schema: this.scenario.schemaConfig || 'default',
        changeName: this.scenario.changeName,
        timestamp: new Date().toISOString(),
        durationMs,
        overallStatus: failed > 0 ? 'fail' : skipped > 0 ? 'partial' : 'pass',
      },
      environment: {
        nodeVersion: process.version,
        openspecAvailable: this.env.openspecAvailable,
        openspecVersion: this.env.openspecVersion,
        pipelineInitResult: this.env.pipelineInitResult,
      },
      phases: phaseResults,
      summary: {
        totalPhases: phaseResults.length,
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
      startedAt: new Date().toISOString(),
      durationMs: 0,
      agentSummary: `Skipped: ${reason}`,
      assertions: [],
      artifacts: [],
    };
  }
}
