import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import type { PipelineReport, ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';
import { ALL_PHASES } from '../../src/harness/types.js';
import { ReportGenerator } from '../../src/report/ReportGenerator.js';
import { PipelineReportSchema } from '../../src/report/ReportSchema.js';

const scenario: ScenarioConfig = {
  name: 'codex-fullstack-todo-delivery',
  sampleProject: 'fullstack-todo',
  phases: ALL_PHASES,
  toolId: 'codex',
  openspecMode: 'mock',
  changeName: 'add-todo-due-date',
  featureDescription: 'Add an optional dueDate field to backend and frontend todo contracts',
};

describe('E2E - Full gated delivery (Codex)', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let env: TestEnvironment;
  let report: PipelineReport;

  beforeAll(async () => {
    orchestrator = new PipelineAgentOrchestrator(scenario, deterministicPipelineExecutor);
    report = await orchestrator.runFullFlow();
    env = orchestrator.getEnvironment();
  }, 120000);

  afterAll(async () => {
    await env.cleanup();
  });

  it('executes all seven phases without synthetic or skipped results (Codex)', () => {
    expect(report.phases.map((phase) => phase.phaseId)).toEqual(ALL_PHASES);
    expect(report.phases.every((phase) => phase.status === 'pass')).toBe(true);
    expect(report.summary).toMatchObject({
      totalPhases: 7,
      passedPhases: 7,
      failedPhases: 0,
      skippedPhases: 0,
      failedAssertions: 0,
      overallScore: 100,
    });
    expect(report.meta.overallStatus).toBe('pass');
  });

  it('installs the Codex skill bundle and records completed delivery state', async () => {
    expect(await fs.pathExists(path.join(env.skillRoot, 'SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(env.rootDir, '.codex/prompts/opsx-dev-pipeline.md'))).toBe(
      true,
    );
    expect(
      await fs.pathExists(path.join(env.rootDir, '.codex/commands/opsx-dev-pipeline.md')),
    ).toBe(true);
    expect(await fs.readFile(path.join(env.rootDir, '.gitignore'), 'utf8')).toContain(
      'openspec/.pipeline-state/',
    );

    const state = await fs.readJson(
      path.join(env.rootDir, 'openspec/.pipeline-state/add-todo-due-date.json'),
    );
    expect(state).toMatchObject({
      currentPhase: 6,
      status: 'completed',
      sourceBranch: env.sourceBranch,
      targetBranch: env.targetBranch,
      review: {
        currentRound: 1,
        status: 'passed',
        rounds: expect.arrayContaining([expect.objectContaining({ round: 1, status: 'passed' })]),
      },
      tests: { attempts: 1, status: 'passed', command: 'npm test' },
      verify: { attempts: 1, status: 'passed', command: 'npm run verify' },
      delivery: { sourcePushed: true, targetPushed: true },
    });
  });

  it('runs post-merge tests and leaves both remote refs available (Codex)', async () => {
    const phase6 = report.phases.find((phase) => phase.phaseId === 'phase-6-merge-push');
    expect(phase6?.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(phase6?.phaseData).toMatchObject({
      commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      mergeCommitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
    });
  });

  it('generates schema-valid JSON and Markdown reports from real results (Codex)', async () => {
    const outputDir = path.join(env.rootDir, '.e2e-reports');
    const generated = await new ReportGenerator(outputDir).generate(report);
    const json = await fs.readJson(generated.jsonPath);
    expect(() => PipelineReportSchema.parse(json)).not.toThrow();
    const markdown = await fs.readFile(generated.markdownPath, 'utf8');
    expect(markdown).toContain('| Total Phases | 7 |');
    expect(markdown).toContain('**100/100**');
    expect(json.summary.overallScore).toBe(100);
  });
});
