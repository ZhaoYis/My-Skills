import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../config/database.js';
import { getEnv } from '../config/env.js';
import { observability, type SchedulerJob } from '../observability/metrics.js';
import { CollectionService } from '../services/collection-service.js';
import { kickCollectionQueue } from '../services/collection-worker.js';
import { RetentionService } from '../services/retention-service.js';
import { logger } from '../utils/logger.js';

let collectionTask: ScheduledTask | undefined;
let retentionTask: ScheduledTask | undefined;

function schedulerErrorCategory(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code.startsWith('P')) return 'database';
  }
  return 'system';
}

async function runScheduledJob(job: SchedulerJob, operation: () => Promise<unknown>) {
  const startedAt = Date.now();
  observability.startSchedulerRun(job, startedAt);
  try {
    await operation();
    observability.finishSchedulerRun(job, 'success', startedAt);
    logger.info(
      { schedulerJob: job, durationMs: Date.now() - startedAt },
      'scheduled job completed',
    );
  } catch (error) {
    const errorCategory = schedulerErrorCategory(error);
    observability.finishSchedulerRun(job, 'error', startedAt);
    logger.error(
      {
        schedulerJob: job,
        durationMs: Date.now() - startedAt,
        errorCategory,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      },
      'scheduled job failed',
    );
  }
}

export function startCollectorScheduler(
  schedule = getEnv().COLLECTOR_CRON_SCHEDULE,
): ScheduledTask {
  if (!cron.validate(schedule)) throw new Error(`Invalid collector schedule: ${schedule}`);
  const service = new CollectionService(prisma);
  observability.configureScheduler('collector');
  void kickCollectionQueue(service);
  collectionTask ??= cron.schedule(schedule, () =>
    runScheduledJob('collector', async () => {
      await service.enqueueAll({ triggerSource: 'scheduled' });
      await kickCollectionQueue(service);
    }),
  );
  return collectionTask;
}

export function startRetentionScheduler(
  schedule = getEnv().RETENTION_CRON_SCHEDULE,
): ScheduledTask {
  if (!cron.validate(schedule)) throw new Error(`Invalid retention schedule: ${schedule}`);
  const service = new RetentionService(prisma);
  observability.configureScheduler('retention');
  const run = () => runScheduledJob('retention', () => service.run({ triggerSource: 'scheduled' }));
  void run();
  retentionTask ??= cron.schedule(schedule, run);
  return retentionTask;
}

export function stopCollectorScheduler() {
  collectionTask?.stop();
  retentionTask?.stop();
  observability.stopScheduler('collector');
  observability.stopScheduler('retention');
  collectionTask = undefined;
  retentionTask = undefined;
}
