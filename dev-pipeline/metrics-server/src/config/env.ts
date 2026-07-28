import 'dotenv/config';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parsePrivateKeyRing } from '../collectors/fingerprint-verifier.js';

const providerProtocols = {
  postgresql: new Set(['postgresql:', 'postgres:']),
  mysql: new Set(['mysql:']),
} as const;
const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess((value) => (value === '' ? undefined : value), z.url().optional());
const envBoolean = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(String(defaultValue) as 'true' | 'false')
    .transform((value) => value === 'true');
const serviceKeyPurpose = z.enum(['session-exchange', 'management']);
const serviceKeyRing = z
  .string()
  .default('{}')
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({ code: 'custom', message: 'SERVICE_API_KEYS must be valid JSON' });
      return z.NEVER;
    }
  })
  .pipe(
    z.record(
      z.string().min(1).max(64),
      z.object({
        sha256: z.string().regex(/^[a-f0-9]{64}$/i),
        purposes: z.array(serviceKeyPurpose).min(1),
      }),
    ),
  );

function isPlaceholder(value: string) {
  return /(replace|placeholder|change[-_ ]?me|example|test[-_ ]?secret)/i.test(value);
}

const placeholderServiceKeyHashes = new Set(
  ['replace-me', 'change-me', 'placeholder', 'example', 'test-secret'].map((value) =>
    createHash('sha256').update(value).digest('hex'),
  ),
);

function configuredTogether(values: Array<string | undefined>) {
  const configured = values.filter(Boolean).length;
  return configured === 0 || configured === values.length;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DB_PROVIDER: z.enum(['postgresql', 'mysql']).default('postgresql'),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1).default('opsx-metrics-server'),
    JWT_AUDIENCE: z.string().min(1).default('opsx-metrics-api'),
    SERVICE_API_KEYS: serviceKeyRing,
    API_KEY: optionalSecret,
    DEV_IMPERSONATE_DEVELOPER_ID: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    FINGERPRINT_PRIVATE_KEYS: z.string().default('{}'),
    COLLECTOR_TEMP_DIR: z.string().default('.collector'),
    COLLECTOR_CRON_SCHEDULE: z.string().default('0 */4 * * *'),
    COLLECTOR_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
    COLLECTOR_LOCK_TIMEOUT: z.coerce.number().int().positive().default(7_200_000),
    COLLECTOR_TRANSACTION_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
    COLLECTOR_RETRY_BASE_DELAY: z.coerce.number().int().min(1).max(60_000).default(50),
    METRICS_TEAM_CACHE_TTL_MS: z.coerce.number().int().min(1_000).default(60_000),
    METRICS_RESULT_CACHE_TTL_MS: z.coerce.number().int().min(0).default(15_000),
    METRICS_PERCENTILE_MAX_ROWS: z.coerce.number().int().min(100).default(100_000),
    RETENTION_ENABLED: envBoolean(false),
    RETENTION_DRY_RUN: envBoolean(true),
    RETENTION_CONFIRMATION: optionalSecret,
    RETENTION_CRON_SCHEDULE: z.string().default('30 2 * * *'),
    FEISHU_BASE_URL: z.url().default('https://open.feishu.cn'),
    FEISHU_APP_ID: optionalSecret,
    FEISHU_APP_SECRET: optionalSecret,
    LDAP_URL: optionalUrl,
    LDAP_BIND_DN: optionalSecret,
    LDAP_BIND_PASSWORD: optionalSecret,
    WECOM_CORP_ID: optionalSecret,
    WECOM_CORP_SECRET: optionalSecret,
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .superRefine((env, context) => {
    const protocol = new URL(env.DATABASE_URL).protocol;
    if (!providerProtocols[env.DB_PROVIDER].has(protocol as never)) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: `DATABASE_URL protocol ${protocol} does not match DB_PROVIDER=${env.DB_PROVIDER}`,
      });
    }
    if (env.NODE_ENV === 'production' && env.DEV_IMPERSONATE_DEVELOPER_ID !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['DEV_IMPERSONATE_DEVELOPER_ID'],
        message: 'Developer impersonation cannot be enabled in production',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (isPlaceholder(env.JWT_SECRET)) {
        context.addIssue({
          code: 'custom',
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET cannot use a placeholder value in production',
        });
      }
      if (env.API_KEY) {
        context.addIssue({
          code: 'custom',
          path: ['API_KEY'],
          message: 'Raw API_KEY is not allowed in production; configure SERVICE_API_KEYS hashes',
        });
      }
      if (!Object.keys(env.SERVICE_API_KEYS).length) {
        context.addIssue({
          code: 'custom',
          path: ['SERVICE_API_KEYS'],
          message: 'At least one hashed service API key is required in production',
        });
      }
      for (const [keyId, serviceKey] of Object.entries(env.SERVICE_API_KEYS)) {
        if (isPlaceholder(keyId) || placeholderServiceKeyHashes.has(serviceKey.sha256)) {
          context.addIssue({
            code: 'custom',
            path: ['SERVICE_API_KEYS'],
            message: 'SERVICE_API_KEYS cannot contain placeholder key IDs or hashes in production',
          });
        }
      }
      for (const [name, value] of [
        ['JWT_ISSUER', env.JWT_ISSUER],
        ['JWT_AUDIENCE', env.JWT_AUDIENCE],
      ] as const) {
        if (isPlaceholder(value)) {
          context.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} cannot use a placeholder value in production`,
          });
        }
      }
      try {
        parsePrivateKeyRing(env.FINGERPRINT_PRIVATE_KEYS);
      } catch {
        context.addIssue({
          code: 'custom',
          path: ['FINGERPRINT_PRIVATE_KEYS'],
          message:
            'FINGERPRINT_PRIVATE_KEYS must contain a valid RSA-2048 fp1 private key in production',
        });
      }
      const corsOrigins = env.CORS_ORIGIN.split(',').map((value) => value.trim());
      for (const origin of corsOrigins) {
        try {
          const url = new URL(origin);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            ['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
            isPlaceholder(origin)
          ) {
            throw new Error('unsafe origin');
          }
        } catch {
          context.addIssue({
            code: 'custom',
            path: ['CORS_ORIGIN'],
            message: 'CORS_ORIGIN must contain non-placeholder production HTTP(S) origins',
          });
          break;
        }
      }
      for (const [name, value] of [
        ['FEISHU_APP_ID', env.FEISHU_APP_ID],
        ['FEISHU_APP_SECRET', env.FEISHU_APP_SECRET],
        ['LDAP_BIND_DN', env.LDAP_BIND_DN],
        ['LDAP_BIND_PASSWORD', env.LDAP_BIND_PASSWORD],
        ['WECOM_CORP_ID', env.WECOM_CORP_ID],
        ['WECOM_CORP_SECRET', env.WECOM_CORP_SECRET],
      ] as const) {
        if (value && isPlaceholder(value)) {
          context.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} cannot use a placeholder value in production`,
          });
        }
      }
    }
    for (const [names, values] of [
      [
        ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'],
        [env.FEISHU_APP_ID, env.FEISHU_APP_SECRET],
      ],
      [
        ['LDAP_URL', 'LDAP_BIND_DN', 'LDAP_BIND_PASSWORD'],
        [env.LDAP_URL, env.LDAP_BIND_DN, env.LDAP_BIND_PASSWORD],
      ],
      [
        ['WECOM_CORP_ID', 'WECOM_CORP_SECRET'],
        [env.WECOM_CORP_ID, env.WECOM_CORP_SECRET],
      ],
    ] as const) {
      if (!configuredTogether([...values])) {
        context.addIssue({
          code: 'custom',
          path: [names[0]],
          message: `${names.join(', ')} must be configured together`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return envSchema.parse(input);
}

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
