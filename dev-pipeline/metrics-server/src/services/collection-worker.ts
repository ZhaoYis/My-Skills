import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { CollectionService } from './collection-service.js';

let draining: Promise<void> | undefined;

export function kickCollectionQueue(service = new CollectionService(prisma)) {
  draining ??= service
    .processQueue()
    .then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error(
            {
              errorCategory: 'queue-drain',
              errorName: result.reason instanceof Error ? result.reason.name : 'UnknownError',
            },
            'collection queue item failed',
          );
        }
      }
    })
    .finally(() => {
      draining = undefined;
    });
  return draining;
}
