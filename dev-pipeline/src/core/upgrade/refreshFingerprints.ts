import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import pc from 'picocolors';

const execFile = promisify(execFileCallback);
const MAX_BUFFER = 10 * 1024 * 1024;

export interface FingerprintRefreshResult {
  status: 'ok';
  reason: string;
  detected: number;
  compliant: number;
  eligible: number;
  refreshed: number;
  skipped: number;
  dryRun: boolean;
}

function commandOutput(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const processError = error as { stdout?: string | Buffer; stderr?: string | Buffer };
  return [processError.stdout, processError.stderr]
    .map((value) => (Buffer.isBuffer(value) ? value.toString('utf8') : value))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .trim();
}

function parseResult(stdout: string): FingerprintRefreshResult {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`Fingerprint refresh returned invalid JSON: ${stdout.trim()}`);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    (payload as { status?: unknown }).status !== 'ok' ||
    !['detected', 'compliant', 'eligible', 'refreshed', 'skipped'].every((field) =>
      Number.isInteger((payload as Record<string, unknown>)[field]),
    ) ||
    typeof (payload as { reason?: unknown }).reason !== 'string' ||
    typeof (payload as { dryRun?: unknown }).dryRun !== 'boolean'
  ) {
    throw new Error(`Fingerprint refresh returned an invalid result: ${stdout.trim()}`);
  }

  return payload as FingerprintRefreshResult;
}

export async function refreshUpgradeFingerprints(input: {
  rootDir: string;
  targetDir: string;
  dryRun: boolean;
}): Promise<FingerprintRefreshResult> {
  const script = path.join(
    input.rootDir,
    'src',
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'scripts',
    'dev-pipeline-state.mjs',
  );
  const args = [script, 'refresh-fingerprints', input.targetDir];
  if (input.dryRun) args.push('--dry-run');

  let stdout: string;
  try {
    const result = await execFile(process.execPath, args, {
      cwd: input.targetDir,
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
    });
    stdout = result.stdout;
  } catch (error) {
    const detail = commandOutput(error);
    throw new Error(`Fingerprint refresh failed${detail ? `: ${detail}` : ''}`);
  }

  const result = parseResult(stdout.trim());
  const action = input.dryRun ? 'would be refreshed' : 'refreshed';
  console.log(
    pc.cyan(
      `Fingerprint check: detected ${result.detected}; ${result.compliant} compliant; ${result.eligible} ${action}; ${result.skipped} skipped.`,
    ),
  );
  return result;
}
