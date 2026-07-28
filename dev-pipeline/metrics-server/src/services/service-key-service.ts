import { createHash, timingSafeEqual } from 'node:crypto';
import type { ServicePrincipal } from '../api/types.js';
import type { Env } from '../config/env.js';

export function hashServiceApiKey(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authenticateServiceApiKey(
  presented: string | undefined,
  env: Pick<Env, 'SERVICE_API_KEYS' | 'API_KEY' | 'NODE_ENV'>,
): ServicePrincipal | null {
  if (!presented) return null;
  const separator = presented.indexOf('.');
  if (separator > 0) {
    const keyId = presented.slice(0, separator);
    const secret = presented.slice(separator + 1);
    const configured = env.SERVICE_API_KEYS[keyId];
    if (configured && constantTimeEqual(hashServiceApiKey(secret), configured.sha256)) {
      return {
        kind: 'service',
        service: 'api-key',
        keyId,
        purposes: [...configured.purposes],
        isAdmin: true,
      };
    }
  }
  if (env.NODE_ENV !== 'production' && env.API_KEY && constantTimeEqual(presented, env.API_KEY)) {
    return {
      kind: 'service',
      service: 'api-key',
      keyId: 'legacy',
      purposes: ['session-exchange', 'management'],
      isAdmin: true,
    };
  }
  return null;
}
