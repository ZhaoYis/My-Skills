import { existsSync } from 'node:fs';
import path from 'node:path';
import { emitError, execCommandSync, getRepoRoot, requireCommand } from './pipeline-lib.mjs';

const MAX_BUFFER = 10 * 1024 * 1024;

function failureOutput(error) {
  return [error?.stdout, error?.stderr]
    .map((value) => (Buffer.isBuffer(value) ? value.toString('utf8') : value))
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .trim();
}

function commandSucceeds(command, args, cwd) {
  try {
    execCommandSync(command, args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

requireCommand('openspec', 'openspec-cli-not-found', 'install-openspec');
requireCommand('node', 'node-cli-not-found', 'install-node');
const repoRoot = getRepoRoot();

let openspecVersion;
try {
  openspecVersion = execCommandSync('openspec', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: MAX_BUFFER,
  }).trim();
} catch (error) {
  const exitCode = Number.isInteger(error?.status) ? error.status : 1;
  emitError(
    'openspec-version-failed',
    `openspec --version 执行失败（exit ${exitCode}）：${failureOutput(error)}`,
    'check-openspec-install',
    1,
  );
}

if (!existsSync(path.join(repoRoot, 'openspec/config.yaml'))) {
  emitError(
    'openspec-not-initialized',
    '仓库根目录缺少 openspec/config.yaml',
    'run-openspec-init',
    3,
  );
}

const warnings = [];
if (!commandSucceeds('git', ['config', 'user.name'], repoRoot)) {
  warnings.push('git-config-user-name-missing');
}
if (!commandSucceeds('git', ['config', 'user.email'], repoRoot)) {
  warnings.push('git-config-user-email-missing');
}

let listOutput;
try {
  listOutput = execCommandSync('openspec', ['list', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: MAX_BUFFER,
  });
} catch (error) {
  const exitCode = Number.isInteger(error?.status) ? error.status : 1;
  emitError(
    'openspec-list-failed',
    `openspec list --json 执行失败（exit ${exitCode}）：${failureOutput(error)}`,
    'check-openspec-config',
    5,
  );
}

let rootSource;
try {
  const payload = JSON.parse(listOutput);
  if (!payload.root || typeof payload.root.source !== 'string') throw new Error();
  rootSource = payload.root.source;
} catch {
  emitError(
    'openspec-list-json-invalid',
    '无法解析 openspec list --json 的 root.source',
    'check-openspec-output',
    6,
  );
}

if (rootSource === 'implicit') {
  emitError(
    'openspec-not-initialized',
    'OpenSpec 返回 implicit 根，请先在仓库中执行 openspec init',
    'run-openspec-init',
    3,
  );
}

const result = {
  status: 'ok',
  reason: warnings.length > 0 ? 'preflight-passed-with-warnings' : 'preflight-passed',
  nextAction: 'continue-phase-0',
  warnings,
  openspecVersion,
  rootSource,
};
process.stdout.write(`${JSON.stringify(result)}\n`);
