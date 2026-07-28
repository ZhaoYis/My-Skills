export interface PrismaEnvironment {
  DB_PROVIDER?: string;
  DATABASE_URL?: string;
}

export interface PrismaConfig {
  provider: 'postgresql' | 'mysql';
  providerRoot: string;
  schemaPath: string;
  migrationsPath: string;
  rootSchemaPath: string;
  templatePath: string;
}

export function resolvePrismaConfig(env?: PrismaEnvironment): PrismaConfig;
export function preparePrisma(env?: PrismaEnvironment): Promise<PrismaConfig>;
