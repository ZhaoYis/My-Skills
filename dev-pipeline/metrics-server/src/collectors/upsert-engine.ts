import { Prisma, type PrismaClient } from '@prisma/client';
import { clearMetricsCache } from '../services/metrics-cache.js';
import { durationSeconds, parseStateDate } from '../utils/date.js';
import { contentHash } from '../utils/hash.js';
import { type FingerprintResult, FingerprintVerificationError } from './fingerprint-verifier.js';
import type { PipelineState } from './state-parser.js';

export interface SnapshotMeta {
  repoId: number;
  commitSha: string;
  commitTimestamp: Date;
  rawContent: string;
  source?: 'collector' | 'history-import';
}

export type UpsertResult =
  | { action: 'inserted'; runId: bigint }
  | { action: 'skipped'; reason: 'duplicate' | 'stale-version' };

function jsonValue(value: string | number | boolean | null) {
  return value === null ? Prisma.JsonNull : value;
}

export async function upsertSnapshot(
  db: PrismaClient,
  state: PipelineState,
  fingerprint: FingerprintResult,
  meta: SnapshotMeta,
): Promise<UpsertResult> {
  const hash = contentHash(meta.rawContent);
  const source = meta.source ?? 'collector';
  if (!fingerprint.verified && source !== 'history-import') {
    throw new FingerprintVerificationError(
      'legacy-not-allowed',
      'Legacy fingerprint requires history import mode',
    );
  }
  if (fingerprint.verified && source === 'history-import') {
    throw new FingerprintVerificationError(
      'history-import-requires-legacy',
      'History import mode only accepts legacy fingerprints',
    );
  }
  const result = await db.$transaction(
    async (tx) => {
      const duplicate = await tx.pipelineRun.findUnique({
        where: {
          repoId_changeName_contentHash: {
            repoId: meta.repoId,
            changeName: state.changeName,
            contentHash: hash,
          },
        },
        select: { id: true },
      });
      if (duplicate) return { action: 'skipped', reason: 'duplicate' } as const;

      const currentTrusted = fingerprint.verified
        ? await tx.pipelineRun.findFirst({
            where: { repoId: meta.repoId, changeName: state.changeName, isLatest: true },
            select: { stateVersion: true, completedAtPipeline: true },
          })
        : null;
      if (currentTrusted && state._version <= currentTrusted.stateVersion) {
        return { action: 'skipped', reason: 'stale-version' } as const;
      }

      const currentHistorical = await tx.pipelineRun.findFirst({
        where: { repoId: meta.repoId, changeName: state.changeName, isLatestHistorical: true },
        select: { stateVersion: true },
      });
      const becomesHistoricalLatest =
        !currentHistorical || state._version > currentHistorical.stateVersion;

      let developerId: number | null = null;
      const email = state.createdByEmail.trim().toLowerCase();
      if (fingerprint.verified && email) {
        const now = new Date();
        const developer = await tx.developer.upsert({
          where: { email },
          create: {
            email,
            displayName: state.createdBy,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: { displayName: state.createdBy, lastSeenAt: now },
          select: { id: true },
        });
        developerId = developer.id;
      }

      if (fingerprint.verified) {
        await tx.pipelineRun.updateMany({
          where: { repoId: meta.repoId, changeName: state.changeName, isLatest: true },
          data: { isLatest: false },
        });
      }
      if (becomesHistoricalLatest) {
        await tx.pipelineRun.updateMany({
          where: { repoId: meta.repoId, changeName: state.changeName, isLatestHistorical: true },
          data: { isLatestHistorical: false },
        });
      }

      const created = parseStateDate(state.createdAt);
      const updated = parseStateDate(state.updatedAt);
      const completedAt =
        state.status === 'completed' ? (currentTrusted?.completedAtPipeline ?? updated) : null;
      const run = await tx.pipelineRun.create({
        data: {
          repoId: meta.repoId,
          developerId,
          changeName: state.changeName,
          schemaVersion: state.schemaVersion,
          stateVersion: state._version,
          sourceBranch: state.sourceBranch,
          targetBranch: state.targetBranch,
          currentPhase: state.currentPhase,
          currentStep: state.currentStep,
          status: state.status,
          executionMode: state.executionMode,
          isLatest: fingerprint.verified,
          isLatestHistorical: becomesHistoricalLatest,
          snapshotSource: source,
          fingerprintId: state.fingerprintId,
          fingerprintNonce: state.fingerprintNonce,
          fingerprintVerified: fingerprint.verified,
          fingerprintKeyVersion: fingerprint.keyVersion,
          createdByEmail: state.createdByEmail,
          createdBy: state.createdBy,
          createdAtSource: created,
          machinePlatform: state.machineInfo.platform,
          machineHostname: state.machineInfo.hostname,
          machineOsRelease: state.machineInfo.osRelease,
          machineNodeVersion: state.machineInfo.nodeVersion,
          machineArch: state.machineInfo.arch,
          featureId: state.featureInfo?.featureId,
          featureUrl: state.featureInfo?.featureUrl,
          archivePath: state.archivePath,
          pauseReason: state.pauseReason,
          deliveryCommitSha: state.delivery.commitSha,
          deliveryMergeCommitSha: state.delivery.mergeCommitSha,
          deliverySourcePushed: state.delivery.sourcePushed ?? false,
          deliveryTargetPushed: state.delivery.targetPushed ?? false,
          deliveryTag: state.delivery.tag,
          reviewStatus: state.review.status,
          reviewCurrentRound: state.review.currentRound,
          testsCommand: state.tests.command,
          testsAttempts: state.tests.attempts,
          testsStatus: state.tests.status,
          testsDetail: state.tests.detail,
          verifyCommand: state.verify.command,
          verifyAttempts: state.verify.attempts,
          verifyStatus: state.verify.status,
          verifyDetail: state.verify.detail,
          createdAtPipeline: created,
          updatedAtPipeline: updated,
          completedAtPipeline: completedAt,
          changeDurationSeconds:
            state.status === 'completed'
              ? Math.max(0, Math.floor((updated.getTime() - created.getTime()) / 1000))
              : null,
          contentHash: hash,
          rawStateJson: JSON.parse(meta.rawContent) as Prisma.InputJsonValue,
          commitSha: meta.commitSha,
          commitTimestamp: meta.commitTimestamp,
          decisions: {
            create: Object.entries(state.decisions).map(([decisionKey, value]) => ({
              decisionKey,
              decisionValue: jsonValue(value),
            })),
          },
          gatesBypassed: {
            create: state.gatesBypassed.map((gateName) => ({ gateName })),
          },
          phaseHistory: {
            create: state.phaseHistory.map((entry) => ({
              phase: entry.phase,
              step: entry.step,
              executedBy: entry.executedBy,
              status: entry.status,
              startedAt: parseStateDate(entry.startedAt),
              completedAt: entry.completedAt ? parseStateDate(entry.completedAt) : null,
              durationSeconds: durationSeconds(entry.startedAt, entry.completedAt),
              decisions: {
                create: Object.entries(entry.decisions).map(([decisionKey, value]) => ({
                  decisionKey,
                  decisionValue: jsonValue(value),
                })),
              },
              gatesBypassed: {
                create: entry.gatesBypassed.map((gateName) => ({ gateName })),
              },
            })),
          },
          reviewRounds: {
            create: state.review.rounds.map((round) => ({
              roundNumber: round.round,
              reportPath: round.reportPath,
              status: round.status,
              recordedAt: parseStateDate(round.timestamp),
              decisions: {
                create: Object.entries(round.decisions).map(([decisionKey, value]) => ({
                  decisionKey,
                  decisionValue: jsonValue(value),
                })),
              },
            })),
          },
        },
        select: { id: true },
      });
      return { action: 'inserted', runId: run.id } as const;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 30_000,
      timeout: 30_000,
    },
  );
  if (result.action === 'inserted') clearMetricsCache(db);
  return result;
}
