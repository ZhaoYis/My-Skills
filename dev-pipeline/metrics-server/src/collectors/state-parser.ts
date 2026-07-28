import { z } from 'zod';

const localTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
const decisionValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const decisions = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/), decisionValue);

const phaseEntry = z.object({
  phase: z.number().int().min(0).max(6),
  step: z.number().int().nonnegative(),
  executedBy: z.string().min(1).max(128),
  status: z.enum(['in-progress', 'completed', 'abandoned']),
  startedAt: localTimestamp,
  completedAt: localTimestamp.nullable(),
  decisions,
  gatesBypassed: z.array(z.string().min(1).max(128)),
});

const reviewRound = z.object({
  round: z.number().int().positive(),
  reportPath: z.string().max(512).nullable(),
  status: z.enum(['passed', 'issues-found']),
  timestamp: localTimestamp,
  decisions,
});

export const pipelineStateSchema = z.object({
  schemaVersion: z.literal(3),
  _version: z.number().int().nonnegative(),
  changeName: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/),
  sourceBranch: z.string().min(1).max(255),
  targetBranch: z.string().max(255).nullable(),
  currentPhase: z.number().int().min(0).max(6),
  currentStep: z.number().int().nonnegative(),
  status: z.enum(['active', 'paused', 'completed']),
  executionMode: z.enum(['pipeline', 'standalone', 'hybrid']),
  createdBy: z.string().min(1).max(128),
  createdByEmail: z.string().max(255),
  machineInfo: z.object({
    platform: z.string().min(1).max(64),
    hostname: z.string().min(1).max(255),
    osRelease: z.string().min(1).max(64),
    nodeVersion: z.string().min(1).max(32),
    arch: z.string().min(1).max(16),
  }),
  featureInfo: z
    .object({
      featureId: z.string().min(1).max(255),
      featureUrl: z.string().url().max(1024).nullable(),
    })
    .nullable(),
  fingerprintId: z.string().min(1).max(512),
  fingerprintNonce: z.string().regex(/^[a-fA-F0-9]{8}$/),
  phaseHistory: z.array(phaseEntry),
  gatesBypassed: z.array(z.string().min(1).max(128)),
  decisions,
  review: z.object({
    currentRound: z.number().int().nonnegative(),
    rounds: z.array(reviewRound),
    reportPath: z.string().max(512).nullable(),
    status: z.enum(['pending', 'passed', 'issues-found']),
  }),
  tests: z.object({
    command: z.string().max(1024).nullable(),
    attempts: z.number().int().nonnegative(),
    status: z.enum(['pending', 'passed', 'failed', 'skipped', 'debt-recorded']),
    detail: z.string().nullable(),
  }),
  verify: z.object({
    command: z.string().max(1024).nullable(),
    attempts: z.number().int().nonnegative(),
    status: z.enum(['pending', 'passed', 'failed', 'skipped']),
    detail: z.string().nullable(),
  }),
  archivePath: z.string().max(512).nullable(),
  delivery: z
    .object({
      commitSha: z
        .string()
        .regex(/^[a-f0-9]{40}$/i)
        .nullable()
        .optional(),
      mergeCommitSha: z
        .string()
        .regex(/^[a-f0-9]{40}$/i)
        .nullable()
        .optional(),
      sourcePushed: z.boolean().optional(),
      targetPushed: z.boolean().optional(),
      tag: z.string().max(255).nullable().optional(),
    })
    .passthrough(),
  pauseReason: z.string().max(255).optional(),
  createdAt: localTimestamp,
  updatedAt: localTimestamp,
});

export type PipelineState = z.infer<typeof pipelineStateSchema>;

export function parsePipelineState(content: string): PipelineState {
  return pipelineStateSchema.parse(JSON.parse(content));
}
