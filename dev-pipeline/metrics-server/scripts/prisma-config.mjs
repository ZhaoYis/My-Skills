import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const serverRoot = fileURLToPath(new URL('..', import.meta.url));

const providerProtocols = {
  postgresql: new Set(['postgresql:', 'postgres:']),
  mysql: new Set(['mysql:']),
};

export function resolvePrismaConfig(env = process.env) {
  const provider = env.DB_PROVIDER || 'postgresql';
  if (!(provider in providerProtocols)) throw new Error(`Unsupported DB_PROVIDER: ${provider}`);

  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for Prisma commands');
  let protocol;
  try {
    protocol = new URL(env.DATABASE_URL).protocol;
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }
  if (!providerProtocols[provider].has(protocol)) {
    throw new Error(`DATABASE_URL protocol ${protocol} does not match DB_PROVIDER=${provider}`);
  }

  const providerRoot = `${serverRoot}/prisma/providers/${provider}`;
  return {
    provider,
    providerRoot,
    schemaPath: `${providerRoot}/schema.prisma`,
    migrationsPath: `${providerRoot}/migrations`,
    rootSchemaPath: `${serverRoot}/prisma/schema.prisma`,
    templatePath: `${serverRoot}/prisma/schema.template.prisma`,
  };
}

export async function preparePrisma(env = process.env) {
  const config = resolvePrismaConfig(env);
  const template = await readFile(config.templatePath, 'utf8');
  const schema = template.replace('__DB_PROVIDER__', config.provider);
  if (schema === template) throw new Error('Prisma schema template is missing __DB_PROVIDER__');

  await mkdir(config.providerRoot, { recursive: true });
  await writeFile(config.schemaPath, schema);
  await writeFile(config.rootSchemaPath, schema);
  await validateMigrations(config);
  return config;
}

async function validateMigrations(config) {
  const lockPath = `${config.migrationsPath}/migration_lock.toml`;
  const lock = await readFile(lockPath, 'utf8');
  const marker = lock.match(/^provider\s*=\s*"([^"]+)"/m)?.[1];
  if (marker !== config.provider) {
    throw new Error(`Migration provider ${marker || 'missing'} does not match DB_PROVIDER=${config.provider}`);
  }

  const entries = await readdir(config.migrationsPath, { withFileTypes: true });
  const migrations = entries.filter((entry) => entry.isDirectory());
  if (!migrations.length) throw new Error(`No migrations found for DB_PROVIDER=${config.provider}`);
  for (const migration of migrations) {
    await access(`${config.migrationsPath}/${migration.name}/migration.sql`);
  }
}
