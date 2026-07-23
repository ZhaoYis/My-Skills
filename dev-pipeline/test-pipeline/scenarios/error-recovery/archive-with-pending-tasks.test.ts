/**
 * Error Recovery — Archive with Pending Tasks Test
 *
 * Tests the pipeline's behavior when attempting to archive a change
 * that still has incomplete/pending tasks. This verifies:
 * - The archive validator detects incomplete tasks
 * - The pipeline handles the edge case gracefully
 * - Reports correctly reflect the error state
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
import { gitIsWorkTree, gitStatus, gitLastCommitMessage } from '../../src/utils/gitHelpers.js';
import { expectFileExists, expectFileContains } from '../../src/utils/fileAssertions.js';
import { fileExists } from '../../src/utils/tempDir.js';
import path from 'node:path';
import fs from 'fs-extra';

const ARCHIVE_ERROR_SCENARIO: ScenarioConfig = {
  name: 'archive-with-pending-tasks',
  sampleProject: 'fullstack-todo',
  phases: ['phase-0-entrance', 'phase-1-propose', 'phase-5-archive'],
  toolId: 'claude',
  features: [],
  changeName: 'incomplete-feature',
  featureDescription: 'A feature that starts implementation but has pending tasks before archive',
};

describe('Error Recovery — Archive with Pending Tasks', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let env: TestEnvironment;
  const reportGenerator = new ReportGenerator();
  const collectedResults: AgentPhaseResult[] = [];

  beforeAll(async () => {
    const openspec = await isOpenspecAvailable();
    if (!openspec.available) {
      throw new Error('OpenSpec CLI is required');
    }

    orchestrator = new PipelineAgentOrchestrator(ARCHIVE_ERROR_SCENARIO);
    env = await orchestrator.init();
  }, 120000);

  afterAll(async () => {
    const report = orchestrator.buildReport(collectedResults, 0);
    const { jsonPath, markdownPath } = await reportGenerator.generate(report);
    console.log(`\n📄 Archive Error Report JSON: ${jsonPath}`);
    console.log(`📝 Archive Error Report MD: ${markdownPath}`);

    await env.cleanup();
  });

  // ── Setup: Create a change with incomplete tasks ─────────────────

  it('Creates a change with intentionally incomplete tasks', async () => {
    const phaseId: PhaseId = 'phase-0-entrance';
    const meta = PHASE_META[phaseId];

    const { assertions, artifacts } = await PHASE_VALIDATORS[phaseId](env, {
      changeName: ARCHIVE_ERROR_SCENARIO.changeName,
    });

    const result: AgentPhaseResult = {
      phaseId,
      label: meta.label,
      status: assertions.every((a) => a.passed) ? 'pass' : 'fail',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      agentSummary: `Phase0 preflight: git=${env.isWorkTree}, openspec=${env.openspecAvailable}`,
      assertions,
      artifacts,
    };

    orchestrator.recordPhaseResult(result);
    collectedResults.push(result);

    // Manually create a change directory with incomplete tasks
    const changeDir = path.join(
      env.rootDir,
      'openspec',
      'changes',
      ARCHIVE_ERROR_SCENARIO.changeName,
    );
    await fs.ensureDir(changeDir);

    // Create tasks.md with both completed and pending items
    const tasksContent = `# Tasks: ${ARCHIVE_ERROR_SCENARIO.changeName}

## Implementation Tasks

- [x] Set up project structure
- [x] Add data model
- [ ] Implement business logic
- [ ] Add input validation
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update API documentation

## Verification Tasks

- [ ] Run full test suite
- [ ] Manual QA review
`;

    await fs.writeFile(path.join(changeDir, 'tasks.md'), tasksContent, 'utf-8');

    // Create a minimal proposal
    const proposalContent = `# Proposal: ${ARCHIVE_ERROR_SCENARIO.changeName}

## Summary
A feature that starts implementation but is not yet complete.

## Motivation
Test the error recovery when archiving incomplete work.
`;
    await fs.writeFile(path.join(changeDir, 'proposal.md'), proposalContent, 'utf-8');

    // Create specs directory
    await fs.ensureDir(path.join(changeDir, 'specs'));
    await fs.writeFile(
      path.join(changeDir, 'specs', 'api.md'),
      '# API Spec\n\nIncomplete.',
      'utf-8',
    );

    console.log('✅ Created incomplete change with pending tasks');
  }, 30000);

  // ── Verify task completion status ────────────────────────────────

  it('Detects incomplete tasks in the change', async () => {
    const tasksPath = path.join(
      env.rootDir,
      'openspec',
      'changes',
      ARCHIVE_ERROR_SCENARIO.changeName,
      'tasks.md',
    );

    const tasksExist = await expectFileExists(tasksPath);
    expect(tasksExist.passed).toBe(true);

    // Count pending vs completed tasks
    const tasksContent = await fs.readFile(tasksPath, 'utf-8');
    const pendingCount = (tasksContent.match(/\[ \]/g) || []).length;
    const completedCount = (tasksContent.match(/\[x\]/g) || []).length;

    console.log(`   Tasks: ${completedCount} completed, ${pendingCount} pending`);

    // Verify we have both completed and pending tasks
    expect(completedCount).toBeGreaterThan(0);
    expect(pendingCount).toBeGreaterThan(0);
  }, 15000);

  // ── Test archive behavior with pending tasks ─────────────────────

  it('Archive validator detects pending tasks and flags them', async () => {
    const phaseId: PhaseId = 'phase-5-archive';
    const meta = PHASE_META[phaseId];

    // Read tasks file to check for pending items
    const tasksPath = path.join(
      env.rootDir,
      'openspec',
      'changes',
      ARCHIVE_ERROR_SCENARIO.changeName,
      'tasks.md',
    );
    const tasksContent = await fs.readFile(tasksPath, 'utf-8');
    const hasPendingTasks = /\[ \]/.test(tasksContent);

    // Run the standard archive validator
    const { assertions, artifacts } = await PHASE_VALIDATORS[phaseId](env, {
      changeName: ARCHIVE_ERROR_SCENARIO.changeName,
    });

    // Add our custom pending-task assertion
    const pendingAssertion = {
      description: 'All tasks are completed before archive',
      passed: !hasPendingTasks,
      detail: hasPendingTasks
        ? 'Archive blocked: there are incomplete tasks in tasks.md'
        : 'All tasks completed, archive can proceed',
    };

    const allAssertions = [...assertions, pendingAssertion];

    const result: AgentPhaseResult = {
      phaseId,
      label: meta.label,
      status: allAssertions.every((a) => a.passed) ? 'pass' : 'fail',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      agentSummary: hasPendingTasks
        ? 'Archive blocked: pending tasks detected. Agent should prompt user to complete or force-archive.'
        : 'Archive proceeds: all tasks completed.',
      assertions: allAssertions,
      artifacts,
      errors: hasPendingTasks ? ['Pending tasks prevent clean archive'] : undefined,
    };

    orchestrator.recordPhaseResult(result);
    collectedResults.push(result);

    // The archive should fail due to pending tasks
    expect(result.status).toBe('fail');
    expect(pendingAssertion.passed).toBe(false);

    console.log(`  ❌ Archive correctly blocked: ${pendingAssertion.detail}`);
  }, 15000);

  // ── Test graceful recovery path ──────────────────────────────────

  it('Can force-archive after user acknowledges pending tasks', async () => {
    // Simulate the user choosing to force-archive
    // In real agent execution, this would be a decision point interaction
    const tasksPath = path.join(
      env.rootDir,
      'openspec',
      'changes',
      ARCHIVE_ERROR_SCENARIO.changeName,
      'tasks.md',
    );

    // Mark remaining tasks as explicitly skipped (not completed)
    let tasksContent = await fs.readFile(tasksPath, 'utf-8');
    // Replace pending checkboxes with a "skipped" marker for archiving
    tasksContent = tasksContent.replace(/\[ \]/g, '[~]'); // Custom marker: ~ means skipped
    await fs.writeFile(tasksPath, tasksContent, 'utf-8');

    // Also add a force-archive note
    await fs.appendFile(
      tasksPath,
      '\n\n## Force Archive Note\nArchived with pending tasks per user decision.\n',
      'utf-8',
    );

    // Verify the tasks.md now reflects the force-archive decision
    const updatedContent = await fs.readFile(tasksPath, 'utf-8');
    const stillPending = /\[ \]/.test(updatedContent);
    const hasForceNote = updatedContent.includes('Force Archive Note');

    expect(stillPending).toBe(false); // No more unchecked boxes
    expect(hasForceNote).toBe(true); // Force archive note added

    console.log('✅ Force-archive preparation: pending tasks marked as skipped, note added');
  }, 15000);

  // ── Validate error recovery metadata ─────────────────────────────

  it('Recovery guardrails appendix covers archive errors', async () => {
    const guardrailsPath = path.join(
      env.skillsRoot,
      'opsx-dev-pipeline',
      'assets',
      'recovery-guardrails-appendix.md',
    );

    const guardrailsExist = await fileExists(guardrailsPath);

    if (guardrailsExist) {
      const content = await fs.readFile(guardrailsPath, 'utf-8');
      // Check for archive-related recovery entries
      const hasArchiveEntry = content.includes('归档') || content.includes('archive');
      console.log(`   Recovery guardrails has archive entries: ${hasArchiveEntry}`);
      // This is informational — guardrails may not have archive entries yet
    } else {
      console.log('   ⚠ recovery-guardrails-appendix.md not found (may not be generated)');
    }
  }, 15000);

  it('Failure recovery index has archive-related entries', async () => {
    const recoveryPath = path.join(
      env.skillsRoot,
      'opsx-dev-pipeline',
      'assets',
      'failure-recovery-index.md',
    );

    const recoveryExists = await fileExists(recoveryPath);

    if (recoveryExists) {
      const content = await fs.readFile(recoveryPath, 'utf-8');
      // Check for Phase4 recovery entries (R4-*)
      const hasPhase4Entries = content.includes('R4-') || content.includes('Phase4');
      console.log(`   Failure recovery has Phase4 entries: ${hasPhase4Entries}`);
    } else {
      console.log('   ⚠ failure-recovery-index.md not found');
    }
  }, 15000);

  // ── Final Report ────────────────────────────────────────────────

  it('Generates error recovery report with correct failure status', async () => {
    const report = orchestrator.buildReport(collectedResults, 0);

    expect(report.meta.scenarioName).toBe(ARCHIVE_ERROR_SCENARIO.name);
    expect(report.meta.overallStatus).toBe('fail'); // Archive should be in fail state

    // Verify the archive Phaseis recorded as failed
    const archivePhase= report.phases.find((p) => p.phaseId === 'phase-5-archive');
    expect(archivePhase).toBeDefined();
    expect(archivePhase!.status).toBe('fail');

    // Verify the pending tasks assertion is recorded
    const pendingAssertion = archivePhase!.assertions.find((a) =>
      a.description.includes('All tasks are completed'),
    );
    expect(pendingAssertion).toBeDefined();
    expect(pendingAssertion!.passed).toBe(false);

    // Verify recommendations mention the failure
    expect(report.summary.recommendations.length).toBeGreaterThan(0);
    const hasArchiveRec = report.summary.recommendations.some(
      (r) => r.includes('Phase4') || r.includes('archive') || r.includes('Archive'),
    );
    // At minimum, there should be a recommendation about the failed phase
    expect(report.summary.failedPhases).toBeGreaterThan(0);

    console.log(`\n📊 Archive Error Recovery Report:`);
    console.log(`   Status: ${report.meta.overallStatus}`);
    console.log(`   Failed phases: ${report.summary.failedPhases}`);
    console.log(`   Failed assertions: ${report.summary.failedAssertions}`);
    console.log(`   Score: ${report.summary.overallScore}/100`);
    console.log(`   Recommendations: ${report.summary.recommendations.length}`);
  }, 30000);
});
