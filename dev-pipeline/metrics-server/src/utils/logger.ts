import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.x-api-key',
      'headers.authorization',
      'headers.x-api-key',
      'authorization',
      'apiKey',
      'DATABASE_URL',
      'JWT_SECRET',
      'FINGERPRINT_PRIVATE_KEYS',
      'privateKey',
      '*.privateKey',
      '*.password',
      '*.secret',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});
