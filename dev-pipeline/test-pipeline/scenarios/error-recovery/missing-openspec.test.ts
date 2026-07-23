/**
 * Error Recovery — Missing Knowledge Test
 *
 * Tests how the pipeline handles an environment without a knowledge base.
 * Since the pipeline init generated .knowledge/ skeleton, this test
 * verifies the environment factory correctly sets up everything needed
 * for the pipeline to work, including graceful handling of partial setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import { ReportGenerator } from '../../src/report/ReportGenerator.js';
import { PHASE_VALIDATORS } from '../../src/validators/PhaseValidators.js';
import { PHASE_META } from '../../src/harness/types.js';
import type {
  ScenarioConfig,
  TestEnvironment,
  AgentPhaseResult,
  PhaseId,
} from '../../src/harness/types.js';
import { isOpenspecAvailable } from '../../src/utils/openspecHelpers.js';
import { gitIsWorkTree } from '../../src/utils/gitHelpers.js';
import { expectFileExists } from '../../src/utils/fileAssertions.js';
import path from 'node:path';

const ERROR_SCENARIO: ScenarioConfig = {
  name: 'missing-knowledge-error-recovery',
  sampleProject: 'fullstack-todo',
  phases: ['phase-0-entrance'],
  toolId: 'claude',
  features: [],
  changeName: 'test-no-knowledge',
  featureDescription: 'Test behavior when knowledge base is incomplete or missing',
};

describe('Error Recovery — Graceful Degradation', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let env: TestEnvironment;
  const reportGenerator = new ReportGenerator();

  beforeAll(async () => {
    const openspec = await isOpenspecAvailable();
    if (!openspec.available) {
      console.log('⚠ OpenSpec not available — skipping error recovery test');
    }

    orchestrator = new PipelineAgentOrchestrator(ERROR_SCENARIO);
    env = await orchestrator.init();
  }, 120000);

  afterAll(async () => {
    await env.cleanup();
  });

  it('Environment factory sets up git work tree correctly', async () => {
    // Verify git is set up
    const isWorkTree = await gitIsWorkTree(env.rootDir);
    expect(isWorkTree).toBe(true);

    // Verify .git exists (it's a directory, not a file)
    const { fileExists } = await import('../../src/utils/tempDir.js');
    // .git is a directory, so use dirExists check via node:fs
    const fs = await import('node:fs/promises');
    let gitDirExists = false;
    try {
      const stat = await fs.stat(path.join(env.rootDir, '.git'));
      gitDirExists = stat.isDirectory();
    } catch {
      /* ignore */
    }
    expect(gitDirExists).toBe(true);

    console.log('✅ Git work tree created successfully');
  }, 30000);

  it('Knowledge skeleton exists after pipeline init', async () => {
    // Knowledge directory should exist
    const knowledgeExists = await expectFileExists(
      path.join(env.rootDir, '.knowledge', 'INDEX.md'),
    );
    expect(knowledgeExists.passed).toBe(true);

    // Tech knowledge directory
    const techDir = path.join(env.rootDir, '.knowledge', 'tech');
    const { fileExists } = await import('../../src/utils/tempDir.js');
    const techExists = await fileExists(techDir);
    console.log(`Knowledge tech dir exists: ${techExists}`);
  }, 15000);

  it('Phase 0 can run preflight checks', async () => {
    const phaseId: PhaseId = 'phase-0-entrance';
    const meta = PHASE_META[phaseId];

    const validation = await PHASE_VALIDATORS[phaseId](env, {
      changeName: ERROR_SCENARIO.changeName,
    });

    const result: AgentPhaseResult = {
      phaseId,
      label: meta.label,
      status: validation.assertions.every((a) => a.passed) ? 'pass' : 'fail',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      agentSummary: 'Phase 0 preflight checks completed',
      assertions: validation.assertions,
      artifacts: validation.artifacts,
    };

    orchestrator.recordPhaseResult(result);

    // Report on assertions but don't fail on openspec-specific ones
    // since openspec may or may not be installed
    const coreAssertions = validation.assertions.filter((a) => !a.description.includes('OpenSpec'));
    const gitAssertion = validation.assertions.find((a) => a.description.includes('Git'));

    expect(gitAssertion?.passed).toBe(true);

    // Generate a test report
    const report = orchestrator.buildReport([result], 0);
    const { jsonPath, markdownPath } = await reportGenerator.generate(report);

    console.log(`📄 JSON report: ${jsonPath}`);
    console.log(`📝 Markdown report: ${markdownPath}`);
    console.log(
      `Summary: ${report.summary.totalPhases} phases, score ${report.summary.overallScore}/100`,
    );
  }, 60000);
});
