import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DB_PROVIDER: z.enum(['postgresql', 'mysql']).default('postgresql'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string().optional(),
  FINGERPRINT_PRIVATE_KEYS: z.string().default('{}'),
  COLLECTOR_TEMP_DIR: z.string().default('.collector'),
  COLLECTOR_CRON_SCHEDULE: z.string().default('0 */4 * * *'),
  COLLECTOR_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  COLLECTOR_LOCK_TIMEOUT: z.coerce.number().int().positive().default(7_200_000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
