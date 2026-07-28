import { randomUUID } from 'node:crypto';
import type { CollectionLog, Prisma, PrismaClient, Repo } from '@prisma/client';
import {
  type FingerprintResult,
  FingerprintVerificationError,
  parsePrivateKeyRing,
  verifyFingerprint,
} from '../collectors/fingerprint-verifier.js';
import {
  COLLECTION_BATCH_SIZE,
  createGitScanPlan,
  processInBatches,
} from '../collectors/git-collector.js';
import { extractStates } from '../collectors/state-extractor.js';
import { type PipelineState, parsePipelineState } from '../collectors/state-parser.js';
import { upsertSnapshot } from '../collectors/upsert-engine.js';
import { type Env, getEnv, loadFingerprintKeys } from '../config/env.js';
import { observability } from '../observability/metrics.js';
import { logger } from '../utils/logger.js';
import { isRetryableTransactionError, withTransactionRetry } from '../utils/transaction-retry.js';

const checkpointPolicy = 'advance-record-rejections';

export interface CollectionSummary {
  repoId: number;
  commitsScanned: number;
  filesFound: number;
  runsUpserted: number;
  runsSkipped: number;
  fingerprintsRejected: number;
  dryRun: boolean;
  mode: CollectionMode;
  rejections: SnapshotRejection[];
  scanFromCommit: string | null;
  scanToCommit: string | null;
  lastRelevantCommit: string | null;
  batchesTotal: number;
  batchesCompleted: number;
  transactionRetries: number;
  forcePushDetected: boolean;
}

export type CollectionMode = 'trusted' | 'history-import';

export interface CollectionOptions {
  dryRun?: boolean;
  mode?: CollectionMode;
  triggerSource?: 'manual' | 'scheduled' | 'cli' | 'retry';
  retryOfId?: bigint;
  attempt?: number;
  jobId?: bigint;
}

export class CollectionJobConflictError extends Error {
  constructor(readonly jobId: bigint) {
    super(`Repository already has an active collection job: ${jobId}`);
    this.name = 'CollectionJobConflictError';
  }
}

class CollectionCancelledError extends Error {
  constructor() {
    super('Collection cancelled by administrator');
    this.name = 'CollectionCancelledError';
  }
}

export interface SnapshotRejection {
  code: string;
  commitSha: string;
  path: string;
  message: string;
}

function classifySystemError(error: unknown) {
  if (isRetryableTransactionError(error)) return 'transaction-conflict';
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code === 'P2028') return 'transaction-timeout';
    if (code.startsWith('P')) return 'database';
  }
  if (error instanceof Error && /git|repository|commit|revision/i.test(error.message)) return 'git';
  return 'system';
}

function logProgress(summary: CollectionSummary) {
  return {
    scanFromCommit: summary.scanFromCommit,
    scanToCommit: summary.scanToCommit,
    lastRelevantCommit: summary.lastRelevantCommit,
    batchSize: COLLECTION_BATCH_SIZE,
    batchesTotal: summary.batchesTotal,
    batchesCompleted: summary.batchesCompleted,
    heartbeatAt: new Date(),
    checkpointPolicy,
    transactionRetries: summary.transactionRetries,
    forcePushDetected: summary.forcePushDetected,
    commitsScanned: summary.commitsScanned,
    filesFound: summary.filesFound,
    runsUpserted: summary.runsUpserted,
    runsSkipped: summary.runsSkipped,
    fingerprintsRejected: summary.fingerprintsRejected,
    rejectionDetails: summary.rejections as unknown as Prisma.InputJsonValue,
  };
}

export class CollectionService {
  private readonly keys;
  private readonly workerId = randomUUID();

  constructor(
    private readonly db: PrismaClient,
    private readonly env: Env = getEnv(),
  ) {
    this.keys = parsePrivateKeyRing(loadFingerprintKeys(env.FINGERPRINT_PRIVATE_KEYS_PATH));
  }

  async acquireLock(repoId: number): Promise<boolean> {
    const staleBefore = new Date(Date.now() - this.env.COLLECTOR_LOCK_TIMEOUT);
    const result = await this.db.repo.updateMany({
      where: {
        id: repoId,
        OR: [
          { collectionStatus: { in: ['idle', 'error'] } },
          { collectionStatus: 'running', collectionStartedAt: { lt: staleBefore } },
        ],
      },
      data: {
        collectionStatus: 'running',
        collectionStartedAt: new Date(),
        collectionError: null,
      },
    });
    return result.count > 0;
  }

  async enqueueRepo(repoId: number, options: CollectionOptions = {}): Promise<CollectionLog> {
    const repo = await this.db.repo.findFirst({
      where: { id: repoId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!repo) throw new Error(`Active repository ${repoId} not found`);
    const active = await this.db.collectionLog.findFirst({
      where: { repoId, status: { in: ['queued', 'running'] } },
      orderBy: { queuedAt: 'desc' },
    });
    if (active) throw new CollectionJobConflictError(active.id);
    return this.db.collectionLog.create({
      data: {
        repoId,
        status: 'queued',
        dryRun: options.dryRun ?? false,
        mode: options.mode ?? 'trusted',
        triggerSource: options.triggerSource ?? 'manual',
        retryOfId: options.retryOfId,
        attempt: options.attempt ?? 1,
        batchSize: COLLECTION_BATCH_SIZE,
        checkpointPolicy,
      },
    });
  }

  async enqueueAll(options: CollectionOptions = {}) {
    const repos = await this.db.repo.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const jobs: CollectionLog[] = [];
    const conflicts: Array<{ repoId: number; jobId: bigint }> = [];
    for (const repo of repos) {
      try {
        jobs.push(await this.enqueueRepo(repo.id, options));
      } catch (error) {
        if (!(error instanceof CollectionJobConflictError)) throw error;
        conflicts.push({ repoId: repo.id, jobId: error.jobId });
      }
    }
    return { jobs, conflicts };
  }

  async runJob(jobId: bigint): Promise<CollectionSummary | null> {
    const startedAt = new Date();
    const claimed = await this.db.collectionLog.updateMany({
      where: { id: jobId, status: 'queued' },
      data: {
        status: 'running',
        startedAt,
        heartbeatAt: startedAt,
        workerId: this.workerId,
        errorCategory: null,
        errorMessage: null,
      },
    });
    if (!claimed.count) return null;
    const job = await this.db.collectionLog.findUniqueOrThrow({ where: { id: jobId } });
    return this.collectRepo(job.repoId, {
      dryRun: job.dryRun,
      mode: job.mode as CollectionMode,
      jobId: job.id,
    });
  }

  async processQueue(): Promise<PromiseSettledResult<CollectionSummary | null>[]> {
    await this.recoverStaleJobs();
    const results: PromiseSettledResult<CollectionSummary | null>[] = [];
    while (true) {
      const jobs = await this.db.collectionLog.findMany({
        where: { status: 'queued' },
        select: { id: true },
        orderBy: { queuedAt: 'asc' },
        take: this.env.COLLECTOR_CONCURRENCY,
      });
      if (!jobs.length) return results;
      results.push(...(await Promise.allSettled(jobs.map(({ id }) => this.runJob(id)))));
    }
  }

  async cancelJob(jobId: bigint) {
    const job = await this.db.collectionLog.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status === 'queued') {
      const now = new Date();
      return this.db.collectionLog.update({
        where: { id: jobId },
        data: { status: 'cancelled', cancelRequestedAt: now, cancelledAt: now, finishedAt: now },
      });
    }
    if (job.status === 'running') {
      return this.db.collectionLog.update({
        where: { id: jobId },
        data: { cancelRequestedAt: new Date() },
      });
    }
    throw new Error(`Collection job ${jobId} is already ${job.status}`);
  }

  async retryJob(jobId: bigint) {
    const job = await this.db.collectionLog.findUniqueOrThrow({ where: { id: jobId } });
    if (!['error', 'cancelled', 'timeout'].includes(job.status)) {
      throw new Error(`Collection job ${jobId} cannot be retried from ${job.status}`);
    }
    return this.enqueueRepo(job.repoId, {
      dryRun: job.dryRun,
      mode: job.mode as CollectionMode,
      triggerSource: 'retry',
      retryOfId: job.id,
      attempt: job.attempt + 1,
    });
  }

  async recoverStaleJobs(now = new Date()) {
    const staleBefore = new Date(now.getTime() - this.env.COLLECTOR_LOCK_TIMEOUT);
    const jobs = await this.db.collectionLog.findMany({
      where: { status: 'running', heartbeatAt: { lt: staleBefore } },
    });
    for (const job of jobs) {
      const message = 'Collection worker heartbeat timed out';
      const updates: Prisma.PrismaPromise<unknown>[] = [
        this.db.collectionLog.update({
          where: { id: job.id },
          data: {
            status: 'timeout',
            errorCategory: 'timeout',
            errorMessage: message,
            finishedAt: now,
          },
        }),
      ];
      if (!job.dryRun) {
        updates.push(
          this.db.repo.update({
            where: { id: job.repoId },
            data: {
              collectionStatus: 'error',
              collectionStartedAt: null,
              collectionError: message,
            },
          }),
        );
      }
      await this.db.$transaction(updates);
      observability.observeCollectionRun('timeout', 'timeout');
      logger.error(
        {
          collectionJobId: job.id.toString(),
          repoId: job.repoId,
          durationMs: Math.max(0, now.getTime() - (job.startedAt?.getTime() ?? now.getTime())),
          errorCategory: 'timeout',
        },
        'collection job timed out',
      );
    }
    return jobs.length;
  }

  async collectRepo(
    repoId: number,
    input: boolean | CollectionOptions = {},
  ): Promise<CollectionSummary> {
    const options = typeof input === 'boolean' ? { dryRun: input } : input;
    const dryRun = options.dryRun ?? false;
    const mode = options.mode ?? 'trusted';
    const repo = await this.db.repo.findUnique({ where: { id: repoId } });
    if (!repo?.isActive) {
      logger.warn({ repoId, errorCategory: 'repository-not-found' }, 'collection job rejected');
      throw new Error(`Active repository ${repoId} not found`);
    }
    if (!dryRun && !(await this.acquireLock(repoId))) {
      if (options.jobId) {
        await this.db.collectionLog.update({
          where: { id: options.jobId },
          data: {
            status: 'error',
            errorCategory: 'duplicate',
            errorMessage: `Repository ${repoId} is already collecting`,
            finishedAt: new Date(),
          },
        });
      }
      observability.observeCollectionRun('error', 'duplicate');
      logger.warn(
        {
          collectionJobId: options.jobId?.toString(),
          repoId,
          durationMs: 0,
          errorCategory: 'duplicate',
        },
        'collection job rejected',
      );
      throw new Error(`Repository ${repoId} is already collecting`);
    }

    const startedAt = new Date();
    const log = options.jobId
      ? await this.db.collectionLog.findUniqueOrThrow({ where: { id: options.jobId } })
      : await this.db.collectionLog.create({
          data: {
            repoId,
            startedAt,
            status: 'running',
            dryRun,
            mode,
            triggerSource: options.triggerSource ?? 'cli',
            heartbeatAt: startedAt,
            batchSize: COLLECTION_BATCH_SIZE,
            checkpointPolicy,
          },
        });
    const summary: CollectionSummary = {
      repoId,
      commitsScanned: 0,
      filesFound: 0,
      runsUpserted: 0,
      runsSkipped: 0,
      fingerprintsRejected: 0,
      dryRun,
      mode,
      rejections: [],
      scanFromCommit: repo.lastFetchedCommit,
      scanToCommit: null,
      lastRelevantCommit: null,
      batchesTotal: 0,
      batchesCompleted: 0,
      transactionRetries: 0,
      forcePushDetected: false,
    };

    try {
      await this.ensureNotCancelled(log.id);
      const plan = await createGitScanPlan(repo, this.env.COLLECTOR_TEMP_DIR);
      summary.scanFromCommit = plan.scanFromCommit;
      summary.scanToCommit = plan.scanToCommit;
      summary.commitsScanned = plan.commits.length;
      summary.batchesTotal = Math.ceil(plan.commits.length / COLLECTION_BATCH_SIZE);
      summary.forcePushDetected = plan.forcePushDetected;
      if (dryRun) {
        await this.db.collectionLog.update({ where: { id: log.id }, data: logProgress(summary) });
      } else {
        await this.db.$transaction([
          this.db.repo.update({
            where: { id: repoId },
            data: {
              scanFromCommit: plan.scanFromCommit,
              scanToCommit: plan.scanToCommit,
              checkpointPolicy,
            },
          }),
          this.db.collectionLog.update({ where: { id: log.id }, data: logProgress(summary) }),
        ]);
      }

      await processInBatches(
        plan.commits,
        async (commit) => {
          await this.ensureNotCancelled(log.id);
          const states = await extractStates(plan.git, commit.sha);
          summary.filesFound += states.length;
          for (const snapshot of states) {
            let state: PipelineState;
            try {
              state = parsePipelineState(snapshot.content);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              summary.runsSkipped += 1;
              summary.rejections.push({
                code: 'state-parse-error',
                commitSha: commit.sha,
                path: snapshot.path,
                message,
              });
              logger.warn(
                {
                  collectionJobId: log.id.toString(),
                  repoId,
                  commitSha: commit.sha,
                  path: snapshot.path,
                  errorCategory: 'state-parse',
                  reasonCode: 'state-parse-error',
                },
                'snapshot rejected',
              );
              continue;
            }

            let fingerprint: FingerprintResult;
            try {
              fingerprint = verifyFingerprint(state, this.keys);
              if (!fingerprint.verified && mode === 'trusted') {
                throw new FingerprintVerificationError(
                  'legacy-not-allowed',
                  'Legacy fingerprint requires history import mode',
                );
              }
              if (fingerprint.verified && mode === 'history-import') {
                throw new FingerprintVerificationError(
                  'history-import-requires-legacy',
                  'History import mode only accepts legacy fingerprints',
                );
              }
            } catch (error) {
              if (!(error instanceof FingerprintVerificationError)) throw error;
              summary.fingerprintsRejected += 1;
              summary.rejections.push({
                code: error.code,
                commitSha: commit.sha,
                path: snapshot.path,
                message: error.message,
              });
              observability.observeFingerprintRejection(error.code);
              logger.warn(
                {
                  collectionJobId: log.id.toString(),
                  repoId,
                  commitSha: commit.sha,
                  path: snapshot.path,
                  errorCategory: 'fingerprint-rejection',
                  reasonCode: error.code,
                },
                'snapshot rejected',
              );
              continue;
            }

            if (dryRun) {
              summary.runsSkipped += 1;
              continue;
            }
            const result = await withTransactionRetry(
              () =>
                upsertSnapshot(this.db, state, fingerprint, {
                  repoId,
                  commitSha: commit.sha,
                  commitTimestamp: commit.timestamp,
                  rawContent: snapshot.content,
                  source: mode === 'history-import' ? 'history-import' : 'collector',
                }),
              {
                maxAttempts: this.env.COLLECTOR_TRANSACTION_RETRIES,
                baseDelayMs: this.env.COLLECTOR_RETRY_BASE_DELAY,
                onRetry: (attempt, delayMs) => {
                  summary.transactionRetries += 1;
                  logger.warn(
                    { repoId, commitSha: commit.sha, attempt, delayMs },
                    'retrying snapshot transaction',
                  );
                },
              },
            );
            if (result.action === 'inserted') summary.runsUpserted += 1;
            else summary.runsSkipped += 1;
          }
        },
        async (commit, completed) => {
          summary.batchesCompleted = completed;
          summary.lastRelevantCommit = commit.sha;
          if (dryRun) {
            await this.db.collectionLog.update({
              where: { id: log.id },
              data: logProgress(summary),
            });
          } else {
            await this.db.$transaction([
              this.db.repo.update({
                where: { id: repoId },
                data: {
                  lastFetchedCommit: commit.sha,
                  lastRelevantCommit: commit.sha,
                  lastFetchedAt: new Date(),
                },
              }),
              this.db.collectionLog.update({ where: { id: log.id }, data: logProgress(summary) }),
            ]);
          }
        },
      );

      const completedAt = new Date();
      if (dryRun) {
        await this.db.collectionLog.update({
          where: { id: log.id },
          data: {
            ...logProgress(summary),
            status: 'completed',
            errorCategory: null,
            finishedAt: completedAt,
          },
        });
      } else {
        const finalRelevantCommit = plan.forcePushDetected
          ? summary.lastRelevantCommit
          : (summary.lastRelevantCommit ?? repo.lastRelevantCommit);
        await this.db.$transaction([
          this.db.repo.update({
            where: { id: repoId },
            data: {
              scanFromCommit: plan.scanFromCommit,
              scanToCommit: plan.scanToCommit,
              lastFetchedCommit: plan.scanToCommit,
              lastRelevantCommit: finalRelevantCommit,
              lastFetchedAt: new Date(),
              checkpointPolicy,
              collectionStatus: 'idle',
              collectionStartedAt: null,
              collectionError: null,
            },
          }),
          this.db.collectionLog.update({
            where: { id: log.id },
            data: {
              ...logProgress(summary),
              status: 'completed',
              errorCategory: null,
              finishedAt: completedAt,
            },
          }),
        ]);
      }
      const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
      observability.observeCollectionRun('completed');
      logger.info(
        {
          collectionJobId: log.id.toString(),
          repoId,
          durationMs,
          fingerprintsRejected: summary.fingerprintsRejected,
        },
        'collection job completed',
      );
      return summary;
    } catch (error) {
      if (error instanceof CollectionCancelledError) {
        await this.finishCancellation(repo, log.id, dryRun, summary);
        observability.observeCollectionRun('cancelled');
        logger.info(
          {
            collectionJobId: log.id.toString(),
            repoId,
            durationMs: Math.max(0, Date.now() - startedAt.getTime()),
            errorCategory: 'cancelled',
          },
          'collection job cancelled',
        );
      } else {
        const errorCategory = classifySystemError(error);
        await this.failCollection(repo, log.id, error, summary, dryRun);
        observability.observeCollectionRun('error', errorCategory);
        logger.error(
          {
            collectionJobId: log.id.toString(),
            repoId,
            durationMs: Math.max(0, Date.now() - startedAt.getTime()),
            errorCategory,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          },
          'collection job failed',
        );
      }
      throw error;
    }
  }

  async collectAll(dryRun = false): Promise<PromiseSettledResult<CollectionSummary>[]> {
    const { jobs, conflicts } = await this.enqueueAll({ dryRun, triggerSource: 'cli' });
    const results = await Promise.allSettled(jobs.map(({ id }) => this.runJob(id)));
    return [
      ...results.map((result) =>
        result.status === 'fulfilled' && result.value === null
          ? ({ status: 'rejected', reason: new Error('Collection job was not claimed') } as const)
          : (result as PromiseSettledResult<CollectionSummary>),
      ),
      ...conflicts.map(
        ({ jobId }) =>
          ({ status: 'rejected', reason: new CollectionJobConflictError(jobId) }) as const,
      ),
    ];
  }

  private async ensureNotCancelled(logId: bigint) {
    const log = await this.db.collectionLog.findUnique({
      where: { id: logId },
      select: { cancelRequestedAt: true },
    });
    if (log?.cancelRequestedAt) throw new CollectionCancelledError();
  }

  private async finishCancellation(
    repo: Repo,
    logId: bigint,
    dryRun: boolean,
    summary: CollectionSummary,
  ) {
    const now = new Date();
    const logUpdate = this.db.collectionLog.update({
      where: { id: logId },
      data: {
        ...logProgress(summary),
        status: 'cancelled',
        cancelledAt: now,
        finishedAt: now,
        errorCategory: null,
        errorMessage: null,
      },
    });
    if (dryRun) return logUpdate;
    await this.db.$transaction([
      this.db.repo.update({
        where: { id: repo.id },
        data: { collectionStatus: 'idle', collectionStartedAt: null, collectionError: null },
      }),
      logUpdate,
    ]);
  }

  private async failCollection(
    repo: Repo,
    logId: bigint,
    error: unknown,
    summary: CollectionSummary,
    dryRun: boolean,
  ) {
    const message = error instanceof Error ? error.message : String(error);
    const logUpdate = this.db.collectionLog.update({
      where: { id: logId },
      data: {
        ...logProgress(summary),
        status: 'error',
        errorCategory: classifySystemError(error),
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    if (dryRun) return logUpdate;
    await this.db.$transaction([
      this.db.repo.update({
        where: { id: repo.id },
        data: { collectionStatus: 'error', collectionStartedAt: null, collectionError: message },
      }),
      logUpdate,
    ]);
  }
}
