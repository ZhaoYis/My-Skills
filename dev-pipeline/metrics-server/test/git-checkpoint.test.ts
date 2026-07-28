import type { Repo } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createGitScanPlan, processInBatches } from '../src/collectors/git-collector.js';
import { extractStates } from '../src/collectors/state-extractor.js';
import { withTransactionRetry } from '../src/utils/transaction-retry.js';
import { createGitRepositoryFixture } from './helpers/git-repository.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

function repo(gitUrl: string, lastFetchedCommit: string | null = null) {
  return {
    id: 7_007,
    name: 'git-checkpoint-test',
    gitUrl,
    gitBranch: 'main',
    collectSince: new Date(0),
    lastFetchedCommit,
  } as Repo;
}

describe('Git checkpoint scan plan', () => {
  it('fixes a remote HEAD, skips unrelated commits, and detects force-push fallback', async () => {
    const fixture = await createGitRepositoryFixture();
    cleanups.push(fixture.cleanup);
    const relevantSha = await fixture.commit(
      'openspec/.pipeline-state/change.json',
      '{"state":"fixture"}',
      'add pipeline state',
    );
    await fixture.push();

    const first = await createGitScanPlan(repo(fixture.remote), fixture.collector);
    expect(first).toMatchObject({
      scanFromCommit: null,
      scanToCommit: relevantSha,
      forcePushDetected: false,
    });
    expect(first.commits.map(({ sha }) => sha)).toEqual([relevantSha]);
    expect(await extractStates(first.git, relevantSha)).toEqual([
      {
        path: 'openspec/.pipeline-state/change.json',
        content: '{"state":"fixture"}',
      },
    ]);

    const unrelatedHead = await fixture.commit('README.md', 'unrelated\n', 'unrelated change');
    await fixture.push();
    const second = await createGitScanPlan(
      repo(fixture.remote, first.scanToCommit),
      fixture.collector,
    );
    expect(second).toMatchObject({
      scanFromCommit: first.scanToCommit,
      scanToCommit: unrelatedHead,
      forcePushDetected: false,
      commits: [],
    });

    await fixture.rewrite('openspec/.pipeline-state/rewritten.json', '{"rewritten":true}');
    const rewritten = await createGitScanPlan(
      repo(fixture.remote, unrelatedHead),
      fixture.collector,
    );
    expect(rewritten.forcePushDetected).toBe(true);
    expect(rewritten.scanFromCommit).toBeNull();
    expect(rewritten.commits).toHaveLength(1);
    expect(rewritten.commits[0]?.sha).toBe(rewritten.scanToCommit);
  }, 30_000);

  it('checkpoints only complete 100-item batches and resumes after interruption', async () => {
    const items = Array.from({ length: 205 }, (_, index) => index + 1);
    const checkpoints: number[] = [];
    await processInBatches(
      items,
      async () => undefined,
      async (last) => {
        checkpoints.push(last);
      },
    );
    expect(checkpoints).toEqual([100, 200, 205]);

    const interrupted: number[] = [];
    await expect(
      processInBatches(
        items,
        async (item) => {
          if (item === 151) throw new Error('interrupted');
        },
        async (last) => {
          interrupted.push(last);
        },
      ),
    ).rejects.toThrow('interrupted');
    expect(interrupted).toEqual([100]);

    const resumed: number[] = [];
    await processInBatches(
      items.slice(interrupted[0] ?? 0),
      async (item) => {
        resumed.push(item);
      },
      async () => undefined,
    );
    expect(resumed).toEqual(items.slice(100));
  });

  it('resumes a real local Git scan after the first batch of 101 relevant commits', async () => {
    const fixture = await createGitRepositoryFixture();
    cleanups.push(fixture.cleanup);
    for (let index = 1; index <= 101; index += 1) {
      await fixture.commit(
        'openspec/.pipeline-state/batched.json',
        JSON.stringify({ version: index }),
        `pipeline state ${index}`,
      );
    }
    await fixture.push();
    const plan = await createGitScanPlan(repo(fixture.remote), fixture.collector);
    expect(plan.commits).toHaveLength(101);

    const checkpoints: string[] = [];
    await expect(
      processInBatches(
        plan.commits,
        async (commit) => {
          if (commit.sha === plan.commits[100]?.sha) throw new Error('worker stopped');
        },
        async (commit) => {
          checkpoints.push(commit.sha);
        },
      ),
    ).rejects.toThrow('worker stopped');
    expect(checkpoints).toEqual([plan.commits[99]?.sha]);

    const resumed: string[] = [];
    await processInBatches(
      plan.commits.slice(100),
      async (commit) => {
        resumed.push(commit.sha);
      },
      async () => undefined,
    );
    expect(resumed).toEqual([plan.commits[100]?.sha]);
  }, 60_000);

  it('retries P2034 conflicts with bounded exponential backoff', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await withTransactionRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw { code: 'P2034' };
        return 'completed';
      },
      {
        maxAttempts: 3,
        baseDelayMs: 10,
        sleep: async (delay) => {
          delays.push(delay);
        },
      },
    );
    expect(result).toBe('completed');
    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);

    let nonRetryableAttempts = 0;
    await expect(
      withTransactionRetry(
        async () => {
          nonRetryableAttempts += 1;
          throw new Error('fatal');
        },
        { maxAttempts: 3, baseDelayMs: 1, sleep: async () => undefined },
      ),
    ).rejects.toThrow('fatal');
    expect(nonRetryableAttempts).toBe(1);
  });
});
