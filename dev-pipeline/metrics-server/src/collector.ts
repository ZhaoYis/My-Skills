import { parseArgs } from 'node:util';
import { prisma } from './config/database.js';
import { getEnv } from './config/env.js';
import { startCollectorScheduler } from './scheduler/cron.js';
import { CollectionService } from './services/collection-service.js';

const { values } = parseArgs({
  options: {
    all: { type: 'boolean', default: false },
    repo: { type: 'string' },
    daemon: { type: 'boolean', default: false },
    schedule: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

getEnv();
const service = new CollectionService(prisma);

if (values.daemon) {
  startCollectorScheduler(values.schedule);
  process.stdout.write(`Collector scheduled: ${values.schedule ?? getEnv().COLLECTOR_CRON_SCHEDULE}\n`);
} else {
  const result = values.repo
    ? await service.collectRepo(Number(values.repo), values['dry-run'])
    : values.all
      ? await service.collectAll(values['dry-run'])
      : (() => {
          throw new Error('Use --all, --repo <id>, or --daemon');
        })();
  process.stdout.write(`${JSON.stringify(result, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)}\n`);
  await prisma.$disconnect();
}
