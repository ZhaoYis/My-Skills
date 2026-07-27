import type { PrismaClient, Repo } from '@prisma/client';
import { getEnv, type Env } from '../config/env.js';
import { collectGitSnapshots } from '../collectors/git-collector.js';
import { parsePrivateKeyRing, verifyFingerprint } from '../collectors/fingerprint-verifier.js';
import { parsePipelineState } from '../collectors/state-parser.js';
import { upsertSnapshot } from '../collectors/upsert-engine.js';
import { logger } from '../utils/logger.js';

export interface CollectionSummary {
  repoId: number;
  commitsScanned: number;
  filesFound: number;
  runsUpserted: number;
  runsSkipped: number;
  fingerprintsRejected: number;
  dryRun: boolean;
}

export class CollectionService {
  private readonly keys;

  constructor(
    private readonly db: PrismaClient,
    private readonly env: Env = getEnv(),
  ) {
    this.keys = parsePrivateKeyRing(env.FINGERPRINT_PRIVATE_KEYS);
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

  async collectRepo(repoId: number, dryRun = false): Promise<CollectionSummary> {
    const repo = await this.db.repo.findUnique({ where: { id: repoId } });
    if (!repo || !repo.isActive) throw new Error(`Active repository ${repoId} not found`);
    if (!dryRun && !(await this.acquireLock(repoId))) throw new Error(`Repository ${repoId} is already collecting`);

    const startedAt = new Date();
    const log = dryRun
      ? null
      : await this.db.collectionLog.create({ data: { repoId, startedAt, status: 'running' } });
    const summary: CollectionSummary = {
      repoId,
      commitsScanned: 0,
      filesFound: 0,
      runsUpserted: 0,
      runsSkipped: 0,
      fingerprintsRejected: 0,
      dryRun,
    };

    try {
      const batches = await collectGitSnapshots(repo, this.env.COLLECTOR_TEMP_DIR);
      summary.commitsScanned = batches.length;
      for (const { commit, states } of batches) {
        summary.filesFound += states.length;
        for (const snapshot of states) {
          try {
            const state = parsePipelineState(snapshot.content);
            const fingerprint = verifyFingerprint(state, this.keys);
            if (dryRun) {
              summary.runsSkipped += 1;
              continue;
            }
            const result = await upsertSnapshot(this.db, state, fingerprint, {
              repoId,
              commitSha: commit.sha,
              commitTimestamp: commit.timestamp,
              rawContent: snapshot.content,
            });
            result.action === 'inserted' ? (summary.runsUpserted += 1) : (summary.runsSkipped += 1);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            if (reason.startsWith('Fingerprint') || reason.startsWith('Unknown fingerprint')) {
              summary.fingerprintsRejected += 1;
            } else {
              summary.runsSkipped += 1;
            }
            logger.warn({ repoId, commitSha: commit.sha, path: snapshot.path, reason }, 'snapshot rejected');
          }
        }
      }

      if (!dryRun) {
        const lastCommit = batches.at(-1)?.commit;
        await this.db.$transaction([
          this.db.repo.update({
            where: { id: repoId },
            data: {
              collectionStatus: 'idle',
              collectionStartedAt: null,
              collectionError: null,
              ...(lastCommit
                ? { lastFetchedCommit: lastCommit.sha, lastFetchedAt: new Date() }
                : {}),
            },
          }),
          this.db.collectionLog.update({
            where: { id: log!.id },
            data: {
              commitsScanned: summary.commitsScanned,
              filesFound: summary.filesFound,
              runsUpserted: summary.runsUpserted,
              runsSkipped: summary.runsSkipped,
              fingerprintsRejected: summary.fingerprintsRejected,
              status: 'completed',
              finishedAt: new Date(),
            },
          }),
        ]);
      }
      return summary;
    } catch (error) {
      if (!dryRun) await this.failCollection(repo, log!.id, error);
      throw error;
    }
  }

  async collectAll(dryRun = false): Promise<PromiseSettledResult<CollectionSummary>[]> {
    const repos = await this.db.repo.findMany({ where: { isActive: true }, select: { id: true } });
    const results: PromiseSettledResult<CollectionSummary>[] = [];
    for (let offset = 0; offset < repos.length; offset += this.env.COLLECTOR_CONCURRENCY) {
      const batch = repos.slice(offset, offset + this.env.COLLECTOR_CONCURRENCY);
      results.push(...(await Promise.allSettled(batch.map((repo) => this.collectRepo(repo.id, dryRun)))));
    }
    return results;
  }

  private async failCollection(repo: Repo, logId: bigint, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await this.db.$transaction([
      this.db.repo.update({
        where: { id: repo.id },
        data: { collectionStatus: 'error', collectionStartedAt: null, collectionError: message },
      }),
      this.db.collectionLog.update({
        where: { id: logId },
        data: { status: 'error', errorMessage: message, finishedAt: new Date() },
      }),
    ]);
  }
}
