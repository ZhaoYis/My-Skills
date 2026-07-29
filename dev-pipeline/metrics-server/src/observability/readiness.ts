import { parsePrivateKeyRing } from '../collectors/fingerprint-verifier.js';
import { prisma } from '../config/database.js';
import { type Env, getEnv, loadFingerprintKeys } from '../config/env.js';

export interface ReadinessResult {
  ready: boolean;
  category?: 'configuration-not-ready' | 'database-unavailable';
  checks: {
    configuration: 'ok' | 'failed';
    database: 'ok' | 'failed';
  };
}

export type DatabaseProbe = () => Promise<void>;

export function criticalConfigurationReady(env: Env) {
  try {
    parsePrivateKeyRing(loadFingerprintKeys(env.FINGERPRINT_PRIVATE_KEYS_PATH));
    return true;
  } catch {
    return false;
  }
}

const defaultDatabaseProbe: DatabaseProbe = async () => {
  await prisma.$queryRawUnsafe('SELECT 1');
};

export async function checkReadiness(
  databaseProbe: DatabaseProbe = defaultDatabaseProbe,
  env: Env = getEnv(),
): Promise<ReadinessResult> {
  const configuration = criticalConfigurationReady(env) ? 'ok' : 'failed';
  let database: 'ok' | 'failed' = 'ok';
  try {
    await databaseProbe();
  } catch {
    database = 'failed';
  }
  if (configuration === 'failed') {
    return {
      ready: false,
      category: 'configuration-not-ready',
      checks: { configuration, database },
    };
  }
  if (database === 'failed') {
    return {
      ready: false,
      category: 'database-unavailable',
      checks: { configuration, database },
    };
  }
  return { ready: true, checks: { configuration, database } };
}
