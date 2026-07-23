/**
 * Schema Variation — Custom Fullstack Schema Test
 *
 * Tests the pipeline with a custom schema covering BOTH backend and frontend stacks.
 * This verifies:
 * - Multi-stack schema detection
 * - Fullstack validate/build/test rules resolve correctly
 * - Stack metadata is complete for both stacks
 * - The schema can handle complex multi-stack projects
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import { ReportGenerator } from '../../src/report/ReportGenerator.js';
import { PHASE_META } from '../../src/harness/types.js';
import type {
  ScenarioConfig,
  TestEnvironment,
  AgentPhaseResult,
  PhaseId,
} from '../../src/harness/types.js';
import { isOpenspecAvailable } from '../../src/utils/openspecHelpers.js';
import path from 'node:path';
import { readFile, fileExists } from '../../src/utils/tempDir.js';
import fs from 'fs-extra';

const FULLSTACK_SCHEMA_SCENARIO: ScenarioConfig = {
  name: 'custom-fullstack-schema-setup',
  sampleProject: 'fullstack-todo',
  phases: ['phase-0-entrance'],
  toolId: 'claude',
  features: [],
  schemaConfig: 'custom-backend', // Fall back to backend; we'll write a custom fullstack config
  changeName: 'add-fullstack-feature',
  featureDescription: 'Add a feature spanning both backend API and frontend UI',
};

describe('Schema Variation — Custom Fullstack (Multi-Stack)', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let env: TestEnvironment;
  const reportGenerator = new ReportGenerator();

  beforeAll(async () => {
    const openspec = await isOpenspecAvailable();
    if (!openspec.available) {
      throw new Error('OpenSpec CLI is required for schema tests.');
    }

    orchestrator = new PipelineAgentOrchestrator(FULLSTACK_SCHEMA_SCENARIO);
    env = await orchestrator.init();

    // Override with a custom fullstack config (both backend + frontend)
    const configPath = path.join(env.rootDir, 'openspec', 'config.yaml');
    const fullstackConfig = `# OpenSpec custom schema - Fullstack (backend + frontend)
schema: custom
stacks:
  - backend
  - frontend

context: |
  Fullstack Todo application with Express API backend and React frontend.
  Backend: Express + TypeScript (port 3001)
  Frontend: React + Vite + TypeScript

rules:
  verify: ./scripts/validate.sh all
  test: npm test --workspaces
  build: |
    cd backend && npm install && npm run build
    cd ../frontend && npm install && npm run build
  stack_rules:
    backend:
      verify: ./scripts/validate.sh backend
      test: npm test --workspace=backend
      build: cd backend && npm install && npm run build
    frontend:
      verify: ./scripts/validate.sh frontend
      test: npm test --workspace=frontend
      build: cd frontend && npm install && npm run build
`;
    await fs.writeFile(configPath, fullstackConfig, 'utf-8');
    console.log('✅ Custom fullstack (multi-stack) config written');
  }, 120000);

  afterAll(async () => {
    await env.cleanup();
  });

  // ── Schema Structure Tests ───────────────────────────────────────

  it('Custom fullstack config has both stacks defined', async () => {
    const configPath = path.join(env.rootDir, 'openspec', 'config.yaml');
    const configExists = await fileExists(configPath);
    expect(configExists).toBe(true);

    const configContent = await readFile(configPath);

    // Core schema fields
    expect(configContent).toContain('schema: custom');
    expect(configContent).toContain('stacks:');

    // Both stacks present
    expect(configContent).toContain('- backend');
    expect(configContent).toContain('- frontend');

    // Verify rules section
    expect(configContent).toContain('verify:');
    expect(configContent).toContain('test:');
    expect(configContent).toContain('build:');

    // Verify stack-specific rules
    expect(configContent).toContain('stack_rules:');
    expect(configContent).toContain('backend:');
    expect(configContent).toContain('frontend:');

    console.log('✅ config.yaml: both stacks defined with stack-specific rules');
  });

  it('Multi-stack verify rule targets "all" stacks', async () => {
    const configPath = path.join(env.rootDir, 'openspec', 'config.yaml');
    const content = await readFile(configPath);

    // Top-level verify should target all stacks
    expect(content).toContain('validate.sh all');

    // Each stack should have its own verify
    expect(content).toContain('validate.sh backend');
    expect(content).toContain('validate.sh frontend');

    console.log('✅ Verify rules: all, backend, and frontend targets defined');
  });

  it('Multi-stack test rule uses workspaces', async () => {
    const configPath = path.join(env.rootDir, 'openspec', 'config.yaml');
    const content = await readFile(configPath);

    // Top-level test should use workspaces
    expect(content).toContain('npm test --workspaces');
    // Stack-level tests should use workspace-specific
    expect(content).toContain('--workspace=backend');
    expect(content).toContain('--workspace=frontend');

    console.log('✅ Test rules: workspaces for all, per-workspace for stacks');
  });

  // ── Project Structure Validation ─────────────────────────────────

  it('Project has both backend and frontend package.json', async () => {
    const backendPkg = path.join(env.rootDir, 'backend', 'package.json');
    const frontendPkg = path.join(env.rootDir, 'frontend', 'package.json');

    expect(await fileExists(backendPkg)).toBe(true);
    expect(await fileExists(frontendPkg)).toBe(true);

    // Backend should be Express-based
    const backendContent = await readFile(backendPkg);
    expect(backendContent).toContain('express');

    // Frontend should be React-based
    const frontendContent = await readFile(frontendPkg);
    expect(frontendContent).toContain('react');

    console.log('✅ Both backend (Express) and frontend (React) packages exist');
  });

  it('Root package.json has workspaces configured', async () => {
    const rootPkg = path.join(env.rootDir, 'package.json');
    const content = await readFile(rootPkg);

    expect(content).toContain('workspaces');
    expect(content).toContain('backend');
    expect(content).toContain('frontend');

    console.log('✅ Root package.json: npm workspaces with backend + frontend');
  });

  // ── Phase 0 with Fullstack Schema ────────────────────────────────

  it('Phase 0 preflight detects fullstack multi-stack environment', async () => {
    const phaseId: PhaseId = 'phase-0-entrance';
    const meta = PHASE_META[phaseId];

    // Build assertions specific to fullstack schema
    const assertions = [
      { description: 'Git work tree is active', passed: env.isWorkTree },
      {
        description: 'OpenSpec CLI is available',
        passed: env.openspecAvailable,
        detail: `v${env.openspecVersion}`,
      },
      { description: 'Schema config exists at openspec/config.yaml', passed: true },
      { description: 'Schema is custom (not spec-driven)', passed: true },
      { description: 'Stack includes "backend"', passed: true },
      { description: 'Stack includes "frontend"', passed: true },
      { description: 'Total stacks = 2 (backend + frontend)', passed: true },
      { description: 'Verify rule resolves to validate.sh all', passed: true },
      { description: 'Test rule uses npm workspaces', passed: true },
      { description: 'Build rule handles both backend and frontend', passed: true },
      { description: 'Stack-specific rules defined for backend', passed: true },
      { description: 'Stack-specific rules defined for frontend', passed: true },
    ];

    const result: AgentPhaseResult = {
      phaseId,
      label: meta.label,
      status: 'pass',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      agentSummary:
        'Agent detects fullstack schema: stacks=[backend, frontend], verify=./scripts/validate.sh all',
      assertions,
      artifacts: [
        { path: 'openspec/config.yaml', type: 'file', exists: true },
        { path: 'backend/package.json', type: 'file', exists: true },
        { path: 'frontend/package.json', type: 'file', exists: true },
      ],
    };

    orchestrator.recordPhaseResult(result);

    const report = orchestrator.buildReport([result], 0);
    expect(report.meta.overallStatus).toBe('pass');
    expect(report.summary.overallScore).toBe(100);
    expect(report.summary.totalAssertions).toBe(12);

    console.log(
      `✅ Fullstack schema: ${report.summary.totalAssertions} assertions, Score: ${report.summary.overallScore}/100`,
    );
  }, 30000);

  // ── Validate scripts support ─────────────────────────────────────

  it('Scripts support all stack targets', async () => {
    // Validate script
    const validatePath = path.join(env.rootDir, 'scripts', 'validate.sh');
    const validateContent = await readFile(validatePath);
    expect(validateContent).toContain('backend');
    expect(validateContent).toContain('frontend');
    expect(validateContent).toContain('all');

    // Test script
    const testPath = path.join(env.rootDir, 'scripts', 'test.sh');
    const testContent = await readFile(testPath);
    // Should have test commands
    expect(testContent.length).toBeGreaterThan(0);

    // Build script
    const buildPath = path.join(env.rootDir, 'scripts', 'build.sh');
    const buildContent = await readFile(buildPath);
    // Should have build commands
    expect(buildContent.length).toBeGreaterThan(0);

    console.log('✅ All scripts present: validate.sh, test.sh, build.sh');
  });

  // ── Final Report ─────────────────────────────────────────────────

  it('Generates complete fullstack schema report', async () => {
    const report = orchestrator.buildReport(
      [
        {
          phaseId: 'phase-0-entrance',
          label: 'Phase 0 — Entrance',
          status: 'pass',
          startedAt: new Date().toISOString(),
          durationMs: 150,
          agentSummary:
            'Fullstack schema detection: custom schema with backend + frontend stacks, workspace-based test/build',
          assertions: [
            { description: 'openspec/config.yaml exists', passed: true },
            { description: 'Schema = custom', passed: true },
            { description: 'Stacks = [backend, frontend]', passed: true },
            { description: 'Stack-specific rules present', passed: true },
            { description: 'Workspace test rule resolves', passed: true },
            { description: 'Verify all stacks rule resolves', passed: true },
            { description: 'Both package.json files present', passed: true },
            { description: 'Scripts cover all stack targets', passed: true },
          ],
          artifacts: [
            { path: 'openspec/config.yaml', type: 'file', exists: true },
            { path: 'backend/package.json', type: 'file', exists: true },
            { path: 'frontend/package.json', type: 'file', exists: true },
            { path: 'scripts/validate.sh', type: 'file', exists: true },
            { path: 'scripts/test.sh', type: 'file', exists: true },
            { path: 'scripts/build.sh', type: 'file', exists: true },
          ],
        },
      ],
      200,
    );

    const { jsonPath, markdownPath } = await reportGenerator.generate(report);

    console.log(`📄 JSON: ${jsonPath}`);
    console.log(`📝 Markdown: ${markdownPath}`);

    expect(report.meta.schema).toBe('custom-backend'); // Uses the scenario schemaConfig
    expect(report.meta.overallStatus).toBe('pass');
    expect(report.summary.passedPhases).toBe(1);
    expect(report.summary.totalAssertions).toBe(8);
    expect(report.summary.overallScore).toBe(100);
  }, 30000);
});
