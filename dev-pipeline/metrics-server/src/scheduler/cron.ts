import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../config/database.js';
import { getEnv } from '../config/env.js';
import { CollectionService } from '../services/collection-service.js';
import { logger } from '../utils/logger.js';

let task: ScheduledTask | undefined;

export function startCollectorScheduler(schedule = getEnv().COLLECTOR_CRON_SCHEDULE): ScheduledTask {
  if (!cron.validate(schedule)) throw new Error(`Invalid collector schedule: ${schedule}`);
  const service = new CollectionService(prisma);
  task ??= cron.schedule(schedule, async () => {
    try {
      await service.collectAll();
    } catch (error) {
      logger.error({ error }, 'scheduled collection failed');
    }
  });
  return task;
}

export function stopCollectorScheduler() {
  task?.stop();
  task = undefined;
}
