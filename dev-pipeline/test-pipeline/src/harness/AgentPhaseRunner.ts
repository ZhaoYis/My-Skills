import type { PhaseId, AgentPhaseResult, PhaseMeta, TestEnvironment } from './types.js';
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
- For Phase 2 (Apply), write actual code changes to the filesystem.
- For Phase 5 (Unit Tests), actually run \`npm test\`.
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
  },
): string {
  const { changeName, featureDescription, projectRoot } = context;

  switch (phaseId) {
    case 'phase-0-entrance':
      return `\
## Specific Tasks for Phase 0 — Entrance

1. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-preflight.sh\`
2. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-detect-schema.sh\`
3. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-list-changes.sh\`
4. Verify all scripts exit 0 and return valid JSON
5. Determine the entry route: new change → Phase 1`;

    case 'phase-1-propose':
      return `\
## Specific Tasks for Phase 1 — Propose

1. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-new-change.sh "${changeName}"\`
2. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-change-status.sh "${changeName}"\`
3. Generate proposal.md in \`openspec/changes/${changeName}/\`
4. Generate tasks.md with checkbox items
5. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-validate-change.sh "${changeName}"\`
6. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-ensure-change-meta.sh "${changeName}" backend,frontend\`
7. Present proposal for approval (decision point 1)`;

    case 'phase-2-apply':
      return `\
## Specific Tasks for Phase 2 — Apply

1. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-instructions-apply.sh "${changeName}"\`
2. Read tasks.md and implement each task in order
3. For each task: write code → self-review → mark [x]
4. Feature "${featureDescription}" — implement the actual code changes to:
   - Backend: models, routes, tests
   - Frontend: components, API client, tests
5. After all tasks, run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-validate-change.sh "${changeName}"\`
6. Present for review decision (decision point 2)`;

    case 'phase-3-review':
      return `\
## Specific Tasks for Phase 3 — Review

1. Load project conventions from \`CLAUDE.md\`
2. Get git diff: \`git diff HEAD~1 --stat\` and \`git diff HEAD~1\`
3. Perform code review covering:
   - Secret scanning
   - Convention compliance
   - Correctness
   - Security
   - Performance
4. Save review report to \`openspec/review/${changeName}-review.md\`
5. Present findings for decision (decision point 3)`;

    case 'phase-4-archive':
      return `\
## Specific Tasks for Phase 4 — Archive

1. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-change-status.sh "${changeName}"\`
2. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-resolve-verify.sh "${changeName}"\`
3. Run verify as determined above
4. Run: \`bash .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-archive.sh "${changeName}" -y\`
5. Determine post-archive operation (decision point 4)`;

    case 'phase-5-unit-tests':
      return `\
## Specific Tasks for Phase 5 — Unit Tests

1. Identify the test command (from package.json or openspec/config.yaml)
2. Present decision point: run tests or skip?
3. If running: execute \`npm test --workspaces --if-present\`
4. If tests fail, decide: fix or proceed with notes?
5. Record test results`;

    case 'phase-6-merge-push':
      return `\
## Specific Tasks for Phase 6 — Merge & Push

1. Pre-commit checks: \`git status\`, \`git fetch\`
2. Scan for sensitive files
3. Stage: \`git add -A\`
4. Commit with conventional commit format: \`feat(${context.changeName}): <description>\`
5. Push: \`git push origin <branch>\`
6. Display final summary`;

    default:
      return '';
  }
}
