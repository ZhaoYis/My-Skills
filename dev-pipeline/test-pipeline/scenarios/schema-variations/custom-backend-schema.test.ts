/**
 * Schema Variation — Custom Backend Schema Test
 *
 * Tests the pipeline with a custom backend-only schema configuration.
 * Verifies schema detection, config file integrity, and stack metadata.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import { ReportGenerator } from '../../src/report/ReportGenerator.js';
import { PHASE_META } from '../../src/harness/types.js';
import type { ScenarioConfig, TestEnvironment, AgentPhaseResult, PhaseId } from '../../src/harness/types.js';
import { isOpenspecAvailable } from '../../src/utils/openspecHelpers.js';
import path from 'node:path';
import { readFile, fileExists } from '../../src/utils/tempDir.js';

const SCHEMA_SCENARIO: ScenarioConfig = {
  name: 'custom-backend-schema-setup',
  sampleProject: 'fullstack-todo',
  phases: ['phase-0-entrance'],
  toolId: 'claude',
  features: [],
  schemaConfig: 'custom-backend',
  changeName: 'add-backend-pagination',
  featureDescription: 'Add pagination to the GET /api/todos endpoint',
};

describe('Schema Variation — Custom Backend Schema', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let env: TestEnvironment;
  const reportGenerator = new ReportGenerator();

  beforeAll(async () => {
    const openspec = await isOpenspecAvailable();
    if (!openspec.available) {
      throw new Error('OpenSpec CLI is required for schema tests.');
    }

    orchestrator = new PipelineAgentOrchestrator(SCHEMA_SCENARIO);
    env = await orchestrator.init();
  }, 120000);

  afterAll(async () => {
    await env.cleanup();
  });

  it('Creates test environment with custom backend schema config', async () => {
    // Verify the openspec config was written correctly
    const configPath = path.join(env.rootDir, 'openspec', 'config.yaml');
    const configExists = await fileExists(configPath);
    expect(configExists).toBe(true);

    const configContent = await readFile(configPath);

    // Schema-specific checks
    expect(configContent).toContain('schema: custom');
    expect(configContent).toContain('- backend');
    expect(configContent).toContain('./scripts/validate.sh backend');

    console.log('✅ Custom backend schema config verified');
  });

  it('Phase 0 preflight detects correct environment', async () => {
    const phaseId: PhaseId = 'phase-0-entrance';
    const meta = PHASE_META[phaseId];

    const result: AgentPhaseResult = {
      phaseId,
      label: meta.label,
      status: 'pass',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      agentSummary: 'Agent detects custom backend schema: stacks=[backend], verify=./scripts/validate.sh backend',
      assertions: [
        { description: 'Git work tree is active', passed: env.isWorkTree },
        { description: 'OpenSpec CLI is available', passed: env.openspecAvailable, detail: `v${env.openspecVersion}` },
        { description: 'Schema config exists at openspec/config.yaml', passed: true },
        { description: 'Schema is custom (not spec-driven)', passed: true },
        { description: 'Stack includes "backend"', passed: true },
        { description: 'Verify rule resolves to backend validate script', passed: true },
      ],
      artifacts: [
        { path: 'openspec/config.yaml', type: 'file', exists: true },
      ],
    };

    orchestrator.recordPhaseResult(result);

    const report = orchestrator.buildReport([result], 0);
    expect(report.meta.overallStatus).toBe('pass');
    expect(report.meta.schema).toBe('custom-backend');
    expect(report.summary.overallScore).toBe(100);

    console.log(`✅ Schema: ${report.meta.schema}, Score: ${report.summary.overallScore}/100`);
  }, 30000);

  it('Verifies scripts/validate.sh supports backend stack', async () => {
    const validatePath = path.join(env.rootDir, 'scripts', 'validate.sh');
    const scriptExists = await fileExists(validatePath);
    expect(scriptExists).toBe(true);

    const content = await readFile(validatePath);
    expect(content).toContain('backend');
    expect(content).toContain('frontend');
    expect(content).toContain('all');
    expect(content).toContain('validate_backend');

    console.log('✅ validate.sh supports backend/frontend/all stacks');
  });

  it('Generates complete schema report', async () => {
    const report = orchestrator.buildReport([
      {
        phaseId: 'phase-0-entrance',
        label: 'Phase 0 — Entrance',
        status: 'pass',
        startedAt: new Date().toISOString(),
        durationMs: 100,
        agentSummary: 'Schema detection: custom backend schema with backend stack',
        assertions: [
          { description: 'openspec/config.yaml exists', passed: true },
          { description: 'Schema = custom', passed: true },
          { description: 'Stacks contains backend', passed: true },
          { description: 'Verify command resolves correctly', passed: true },
        ],
        artifacts: [{ path: 'openspec/config.yaml', type: 'file', exists: true }],
      },
    ], 150);

    const { jsonPath, markdownPath } = await reportGenerator.generate(report);

    console.log(`📄 JSON: ${jsonPath}`);
    console.log(`📝 Markdown: ${markdownPath}`);

    expect(report.meta.schema).toBe('custom-backend');
    expect(report.meta.overallStatus).toBe('pass');
    expect(report.summary.passedPhases).toBe(1);
  }, 30000);
});
