import type { PhaseId, AgentPhaseResult, TestEnvironment } from './types.js';
import { PHASE_META, ALL_PHASES } from './types.js';
import path from 'node:path';

/**
 * Builds agent prompts and records results for each pipeline phase.
 * The actual agent launch happens via the `Agent` tool; this class
 * builds the prompts that make the agent follow the correct SKILL.md
 * and produce structured output.
 */
export class AgentPhaseRunner {
  private env: TestEnvironment;
  private previousResults: Map<PhaseId, AgentPhaseResult> = new Map();

  constructor(env: TestEnvironment) {
    this.env = env;
  }

  /**
   * Build the agent prompt for a specific phase.
   */
  buildPhasePrompt(phaseId: PhaseId, changeName: string, featureDescription: string): string {
    const meta = PHASE_META[phaseId];
    const skillAbsPath = path.join(this.env.skillsRoot, meta.skillPath);

    // Build context from previous phases
    const previousContext = this.buildPreviousContext(phaseId);

    return this.renderPrompt({
      skillPath: skillAbsPath,
      skillName: meta.skillName,
      phaseId: meta.id,
      phaseLabel: meta.label,
      phaseDescription: meta.description,
      projectRoot: this.env.rootDir,
      projectType: this.env.sampleProject,
      changeName,
      featureDescription,
      previousContext,
    });
  }

  /**
   * Record a phase result and store it for subsequent phases.
   */
  recordResult(result: AgentPhaseResult): void {
    this.previousResults.set(result.phaseId, result);
  }

  /**
   * Get result of a specific previous phase.
   */
  getPreviousResult(phaseId: PhaseId): AgentPhaseResult | undefined {
    return this.previousResults.get(phaseId);
  }

  /**
   * Build a summary of previous phase outputs for agent context.
   */
  private buildPreviousContext(currentPhase: PhaseId): string {
    const phases = this.getPrecedingPhases(currentPhase);
    if (phases.length === 0) return '';

    const lines: string[] = ['## Previous Phase Outputs'];
    for (const phaseId of phases) {
      const result = this.previousResults.get(phaseId);
      if (result) {
        const status = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
        lines.push(`\n### ${result.label} ${status}`);
        lines.push(result.agentSummary);
        if (result.artifacts.filter((a) => a.exists).length > 0) {
          lines.push('\n**Artifacts generated:**');
          for (const a of result.artifacts.filter((a) => a.exists)) {
            lines.push(`  - ${a.path}`);
          }
        }
      }
    }
    return lines.join('\n');
  }

  /**
   * Get phases that should run before the given phase.
   */
  private getPrecedingPhases(currentPhase: PhaseId): PhaseId[] {
    const idx = ALL_PHASES.indexOf(currentPhase);
    return idx > 0 ? ALL_PHASES.slice(0, idx) : [];
  }

  /**
   * Render a complete agent prompt for a pipeline phase.
   */
  private renderPrompt(params: {
    skillPath: string;
    skillName: string;
    phaseId: string;
    phaseLabel: string;
    phaseDescription: string;
    projectRoot: string;
    projectType: string;
    changeName: string;
    featureDescription: string;
    previousContext: string;
  }): string {
    return `You are executing **Phase: ${params.phaseLabel}** of the opsx-dev-pipeline delivery flow.

## Your Task

${params.phaseDescription}

## Project Context

- **Project**: ${params.projectType} (fullstack Todo app with Express backend + React frontend)
- **Working directory**: ${params.projectRoot}
- **Change being implemented**: \`${params.changeName}\`
- **Feature description**: ${params.featureDescription}

## Instructions

1. **Read the skill definition**: The canonical instructions for this phase are at:
   \`${params.skillPath}\`

2. **Read the phase-specific reference**: For pipeline phases, the detailed steps are under:
   \`references/\` directory next to the SKILL.md

3. **Execute the phase**: Follow the skill instructions exactly. Run scripts, write code, generate documentation as required.

4. **Report your results**: After completing the phase, provide a structured summary:

### Phase Result Format

\`\`\`json
{
  "status": "pass" | "fail",
  "summary": "Brief description of what happened",
  "decisionPoints": [
    {"id": "...", "question": "...", "choice": "..."}
  ],
  "artifacts": [
    {"path": "relative/path/to/file", "description": "..."}
  ],
  "issues": [
    {"severity": "info" | "warning" | "error", "description": "..."}
  ]
}
\`\`\`

${params.previousContext}

## Key Rules

- Follow the SKILL.md and its phase reference exactly.
- Do not skip decision points — pause and ask when needed.
- For Phase2 (Apply), write actual code changes to the filesystem.
- For Phase4 (Unit Tests), actually run \`npm test\`.
- Always verify your work before declaring the phase complete.`;
  }
}

/**
 * Phase-specific prompt customizations.
 */
export function getPhaseSpecificInstructions(
  phaseId: PhaseId,
  context: {
    changeName: string;
    featureDescription: string;
    projectRoot: string;
    skillRoot: string;
  },
): string {
  const { changeName, featureDescription } = context;

  switch (phaseId) {
    case 'phase-0-entrance':
      return `\
## Specific Tasks for Phase0 — Entrance

1. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-preflight.sh\`
2. Initialize persistent state with the current source branch
3. Transition state to Phase1 Step3
4. Verify every command returns valid JSON`;

    case 'phase-1-propose':
      return `\
## Specific Tasks for Phase1 — Propose

1. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-new-change.sh "${changeName}"\`
2. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-change-status.sh "${changeName}"\`
3. Generate proposal.md in \`openspec/changes/${changeName}/\`
4. Generate tasks.md with checkbox items
5. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-validate-change.sh "${changeName}"\`
6. Record requirementsConfirmed and proposalApproved before transitioning to Phase2`;

    case 'phase-2-apply':
      return `\
## Specific Tasks for Phase2 — Apply

1. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-instructions-apply.sh "${changeName}"\`
2. Read tasks.md and implement each task in order
3. For each task: write code → self-review → mark [x]
4. Feature "${featureDescription}" — implement the actual code changes to:
   - Backend: models, routes, tests
   - Frontend: components, API client, tests
5. After all tasks, run: \`bash ${context.skillRoot}/scripts/dev-pipeline-validate-change.sh "${changeName}"\`
6. Record implementationConfirmed and reviewDisposition before transitioning`;

    case 'phase-3-review':
      return `\
## Specific Tasks for Phase3 — Review

1. Load project conventions from OpenSpec config and repository guidance
2. Get the current feature diff
3. Perform code review covering:
   - Secret scanning
   - Convention compliance
   - Correctness
   - Security
   - Performance
4. Save the timestamped review report under \`openspec/review/\`
5. Record the review attempt and transition to Phase4`;

    case 'phase-4-unit-tests':
      return `\
## Specific Tasks for Phase4 — Unit Tests

1. Identify the test command (from package.json or openspec/config.yaml)
2. Present decision point: run tests or skip?
3. Execute the selected test command
4. Record each attempt through the state script
5. Transition only after passed, skipped, or debt-recorded`;

    case 'phase-5-archive':
      return `\
## Specific Tasks for Phase5 — Archive

1. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-change-status.sh "${changeName}"\`
2. Resolve the verify command from \`openspec/config.yaml\` and project build files
3. Run verify and require success
4. Run: \`bash ${context.skillRoot}/scripts/dev-pipeline-archive.sh "${changeName}" -y\`
5. Persist verify status, actual archive path, and postArchiveAction before Phase6`;

    case 'phase-6-merge-push':
      return `\
## Specific Tasks for Phase6 — Merge & Push

1. Confirm commit and source push independently
2. Record target branch before checkout
3. Merge using the selected strategy without force operations
4. Re-run tests and verify after merge
5. Confirm target push independently
6. Record delivery SHAs and complete the state`;

    default:
      return '';
  }
}
