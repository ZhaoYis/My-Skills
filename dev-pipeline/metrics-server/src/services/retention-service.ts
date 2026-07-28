import type { Prisma, PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';
import { getEnv } from '../config/env.js';
import { clearMetricsCache } from './metrics-cache.js';

export const RETENTION_CONFIRMATION = 'DELETE_EXPIRED_SNAPSHOTS';

type RetentionConfig = Pick<
  Env,
  'RETENTION_ENABLED' | 'RETENTION_DRY_RUN' | 'RETENTION_CONFIRMATION'
>;

export interface RetentionRunOptions {
  dryRun?: boolean;
  triggerSource: 'manual' | 'scheduled';
  repoId?: number;
  now?: Date;
}

export interface RetentionClassification {
  repoId: number;
  cutoffAt: Date;
  hotRuns: number;
  warmRuns: number;
  coldRuns: number;
  eligibleRuns: number;
  preservedRuns: number;
}

function executionReason(config: RetentionConfig) {
  if (!config.RETENTION_ENABLED) return 'RETENTION_ENABLED is false';
  if (config.RETENTION_CONFIRMATION !== RETENTION_CONFIRMATION) {
    return `RETENTION_CONFIRMATION must equal ${RETENTION_CONFIRMATION}`;
  }
  return null;
}

export class RetentionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly config: RetentionConfig = getEnv(),
  ) {}

  async classify(repoId: number, now = new Date()): Promise<RetentionClassification> {
    const repo = await this.db.repo.findUniqueOrThrow({
      where: { id: repoId },
      select: { id: true, retentionDays: true },
    });
    const cutoffAt = new Date(now.getTime() - repo.retentionDays * 86_400_000);
    const protectedLatest: Prisma.PipelineRunWhereInput = {
      OR: [{ isLatest: true }, { isLatestHistorical: true }],
    };
    const eligible: Prisma.PipelineRunWhereInput = {
      repoId,
      updatedAtPipeline: { lt: cutoffAt },
      isLatest: false,
      isLatestHistorical: false,
    };
    const [hotRuns, warmRuns, coldRuns] = await Promise.all([
      this.db.pipelineRun.count({ where: { repoId, updatedAtPipeline: { gte: cutoffAt } } }),
      this.db.pipelineRun.count({
        where: { repoId, updatedAtPipeline: { lt: cutoffAt }, ...protectedLatest },
      }),
      this.db.pipelineRun.count({ where: eligible }),
    ]);
    return {
      repoId,
      cutoffAt,
      hotRuns,
      warmRuns,
      coldRuns,
      eligibleRuns: coldRuns,
      preservedRuns: hotRuns + warmRuns,
    };
  }

  async run(options: RetentionRunOptions) {
    const now = options.now ?? new Date();
    const requestedDryRun = options.dryRun ?? this.config.RETENTION_DRY_RUN;
    const reason = executionReason(this.config);
    const effectiveDryRun = requestedDryRun || Boolean(reason);
    const repos = await this.db.repo.findMany({
      where: options.repoId ? { id: options.repoId } : {},
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const results = [];
    for (const repo of repos) {
      const started = await this.db.retentionOperationLog.create({
        data: {
          repoId: repo.id,
          status: 'running',
          triggerSource: options.triggerSource,
          dryRun: effectiveDryRun,
          enabled: !reason,
          details: reason ? { executionBlocked: reason } : undefined,
        },
      });
      try {
        const classification = await this.classify(repo.id, now);
        const deleted = effectiveDryRun
          ? { count: 0 }
          : await this.db.pipelineRun.deleteMany({
              where: {
                repoId: repo.id,
                updatedAtPipeline: { lt: classification.cutoffAt },
                isLatest: false,
                isLatestHistorical: false,
              },
            });
        if (deleted.count) clearMetricsCache(this.db);
        const completed = await this.db.retentionOperationLog.update({
          where: { id: started.id },
          data: {
            status: reason ? 'checked' : 'completed',
            finishedAt: new Date(),
            cutoffAt: classification.cutoffAt,
            hotRuns: classification.hotRuns,
            warmRuns: classification.warmRuns,
            coldRuns: classification.coldRuns,
            eligibleRuns: classification.eligibleRuns,
            deletedRuns: deleted.count,
            preservedRuns: classification.preservedRuns,
          },
        });
        results.push(completed);
      } catch (error) {
        await this.db.retentionOperationLog.update({
          where: { id: started.id },
          data: {
            status: 'error',
            finishedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Retention cleanup failed',
          },
        });
        throw error;
      }
    }
    return results;
  }

  async archiveBatch(repoId: number, options: { take?: number; cursor?: bigint; now?: Date } = {}) {
    const classification = await this.classify(repoId, options.now);
    const take = Math.min(1_000, Math.max(1, options.take ?? 100));
    const records = await this.db.pipelineRun.findMany({
      where: {
        repoId,
        updatedAtPipeline: { lt: classification.cutoffAt },
        isLatest: false,
        isLatestHistorical: false,
      },
      select: {
        id: true,
        changeName: true,
        stateVersion: true,
        contentHash: true,
        commitSha: true,
        commitTimestamp: true,
        updatedAtPipeline: true,
        snapshotSource: true,
        fingerprintVerified: true,
        rawStateJson: true,
      },
      orderBy: { id: 'asc' },
      take,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return {
      cutoffAt: classification.cutoffAt,
      records,
      nextCursor: records.length === take ? records.at(-1)?.id : null,
    };
  }

  history(repoId: number, take = 20) {
    return this.db.retentionOperationLog.findMany({
      where: { repoId },
      orderBy: { startedAt: 'desc' },
      take,
    });
  }
}
