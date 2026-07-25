import { z } from 'zod';

/**
 * Zod schemas for the pipeline test report format.
 * These are used for both validation and type inference.
 */

export const AssertionResultSchema = z.object({
  description: z.string(),
  passed: z.boolean(),
  detail: z.string().optional(),
});

export const ArtifactInfoSchema = z.object({
  path: z.string(),
  type: z.enum(['file', 'directory']),
  exists: z.boolean(),
  size: z.number().optional(),
});

export const AgentPhaseResultSchema = z.object({
  phaseId: z.string(),
  label: z.string(),
  status: z.enum(['pass', 'fail', 'skipped', 'error']),
  startedAt: z.string(),
  durationMs: z.number(),
  agentSummary: z.string(),
  assertions: z.array(AssertionResultSchema),
  artifacts: z.array(ArtifactInfoSchema),
  errors: z.array(z.string()).optional(),
  phaseData: z.record(z.string(), z.unknown()).optional(),
});

export const PipelineReportSchema = z.object({
  meta: z.object({
    scenarioName: z.string(),
    sampleProject: z.string(),
    toolId: z.string(),
    changeName: z.string(),
    sourceBranch: z.string(),
    targetBranch: z.string(),
    timestamp: z.string(),
    durationMs: z.number(),
    overallStatus: z.enum(['pass', 'fail', 'partial']),
  }),
  environment: z.object({
    nodeVersion: z.string(),
    openspecAvailable: z.boolean(),
    openspecVersion: z.string().optional(),
    openspecMode: z.enum(['mock', 'missing']),
    pipelineInitResult: z.string().optional(),
  }),
  phases: z.array(AgentPhaseResultSchema),
  summary: z.object({
    totalPhases: z.number(),
    passedPhases: z.number(),
    failedPhases: z.number(),
    skippedPhases: z.number(),
    totalAssertions: z.number(),
    passedAssertions: z.number(),
    failedAssertions: z.number(),
    overallScore: z.number(),
    recommendations: z.array(z.string()),
  }),
});

export type PipelineReportSchemaType = z.infer<typeof PipelineReportSchema>;
