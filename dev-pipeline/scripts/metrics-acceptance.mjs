import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'metrics-server');
const website = path.join(root, 'metrics-website');
const provider = process.env.DB_PROVIDER;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!['postgresql', 'mysql'].includes(provider ?? '')) {
  throw new Error('DB_PROVIDER must be postgresql or mysql for metrics acceptance');
}
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required for metrics acceptance');

const databaseEnv = {
  ...process.env,
  NODE_ENV: 'test',
  DB_PROVIDER: provider,
  DATABASE_URL: process.env.DATABASE_URL ?? testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  JWT_SECRET: process.env.JWT_SECRET ?? 'ci-jwt-credential-at-least-32-characters',
};
const unitEnv = { ...databaseEnv };
delete unitEnv.TEST_DATABASE_URL;
const websiteBuildEnv = {
  ...process.env,
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'ci-auth-credential-at-least-32-characters',
  AUTH_TRUST_HOST: 'true',
  OIDC_ISSUER: process.env.OIDC_ISSUER ?? 'https://sso.ci.internal',
  OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID ?? 'metrics-ci-client',
  OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET ?? 'ci-oidc-credential',
  METRICS_API_URL: process.env.METRICS_API_URL ?? 'https://metrics-api.ci.internal/api/v1',
  METRICS_API_KEY: process.env.METRICS_API_KEY ?? 'ci.ci-service-exchange-credential',
};

function run(label, cwd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[metrics acceptance] ${label}\n`);
    const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
    const commandArgs =
      process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd', ...args] : args;
    const child = spawn(command, commandArgs, { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

const steps = [
  ['server contract', server, ['run', 'contract:check'], unitEnv],
  ['server lint', server, ['run', 'lint'], unitEnv],
  ['server typecheck', server, ['run', 'typecheck'], unitEnv],
  ['server unit and Git tests', server, ['test'], unitEnv],
  ['database schema validation', server, ['run', 'prisma:validate'], databaseEnv],
  ['database client generation', server, ['run', 'prisma:generate'], databaseEnv],
  ['database migrations', server, ['run', 'prisma:migrate'], databaseEnv],
  ['database shape verification', server, ['run', 'prisma:verify-db'], databaseEnv],
  ['database and API integration', server, ['run', 'test:db'], databaseEnv],
  ['website lint', website, ['run', 'lint'], process.env],
  ['website typecheck', website, ['run', 'typecheck'], process.env],
  ['website unit tests', website, ['test'], process.env],
  ['website production build', website, ['run', 'build'], websiteBuildEnv],
  ['desktop and mobile Playwright', website, ['run', 'test:e2e'], process.env],
];

for (const [label, cwd, args, env] of steps) await run(label, cwd, args, env);
process.stdout.write(`\n[metrics acceptance] completed for ${provider}\n`);
