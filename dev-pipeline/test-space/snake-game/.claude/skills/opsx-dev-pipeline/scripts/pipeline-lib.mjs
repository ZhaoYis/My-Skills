import { execFileSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';

const EXIT_DEPENDENCY_MISSING = 1;
const EXIT_NOT_GIT_REPO = 2;
const EXIT_INVALID_INPUT = 4;
const EXIT_COMMAND_FAILED = 5;
const EXIT_INVALID_OUTPUT = 6;
const MAX_BUFFER = 10 * 1024 * 1024;
const MAX_ERROR_DETAIL_LENGTH = 4096;

function normalizePaths(value) {
  if (typeof value === 'string') return value.replaceAll('\\', '/');
  if (Array.isArray(value)) return value.map(normalizePaths);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizePaths(item)]),
    );
  }
  return value;
}

function commandCandidates(name) {
  if (process.platform !== 'win32' || path.extname(name)) return [name];
  const extensions = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';');
  return [name, ...extensions.map((extension) => `${name}${extension.toLowerCase()}`)];
}

function isExecutable(filePath) {
  try {
    const mode = process.platform === 'win32' ? constants.F_OK : constants.X_OK;
    accessSync(filePath, mode);
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function commandExists(name) {
  if (name.includes('/') || name.includes('\\')) {
    return commandCandidates(name).some(isExecutable);
  }

  const directories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return directories.some((directory) =>
    commandCandidates(name).some((candidate) => isExecutable(path.join(directory, candidate))),
  );
}

function commandOutput(error) {
  const parts = [error?.stdout, error?.stderr]
    .map((value) => (Buffer.isBuffer(value) ? value.toString('utf8') : value))
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
  const output = parts.join('\n').trim();
  return output.length > MAX_ERROR_DETAIL_LENGTH
    ? `${output.slice(0, MAX_ERROR_DETAIL_LENGTH)}...`
    : output;
}

export function emitError(reason, detail, nextAction, exitCode) {
  const payload = normalizePaths({ status: 'error', reason, detail, nextAction });
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(exitCode);
}

export function requireCommand(name, reason, nextAction) {
  if (!commandExists(name)) {
    emitError(reason, `找不到命令：${name}`, nextAction, EXIT_DEPENDENCY_MISSING);
  }
}

export function getRepoRoot() {
  requireCommand('git', 'git-cli-not-found', 'install-git');
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: MAX_BUFFER,
    }).trim();
    if (!root) throw new Error('git returned an empty repository root');
    return root;
  } catch {
    emitError('not-a-git-repo', '当前目录不在 Git 仓库内', 'init-git-or-cd', EXIT_NOT_GIT_REPO);
  }
}

export function validateChangeName(value, exitCode = EXIT_INVALID_INPUT) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 64 ||
    !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value)
  ) {
    emitError(
      'invalid-change-name',
      'change 名称必须是 1-64 位 kebab-case，且不能以连字符开头或结尾',
      'choose-valid-change-name',
      exitCode,
    );
  }
}

export function validateIdentifier(label, value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    !/^(?!-)[A-Za-z0-9._-]+$/.test(value)
  ) {
    emitError(
      'invalid-identifier',
      `${label} 必须由字母、数字、点、下划线或连字符组成`,
      'choose-valid-identifier',
      EXIT_INVALID_INPUT,
    );
  }
}

export function runJsonCommand(args, { failureReason, nextAction }) {
  const [command, ...commandArgs] = args;
  let output;
  try {
    output = execFileSync(command, commandArgs, {
      cwd: getRepoRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: MAX_BUFFER,
    });
  } catch (error) {
    const exitCode = Number.isInteger(error?.status) ? error.status : 1;
    const detail = commandOutput(error);
    emitError(
      failureReason,
      `命令执行失败（exit ${exitCode}）：${detail}`,
      nextAction,
      EXIT_COMMAND_FAILED,
    );
  }

  if (!output.trim()) {
    emitError('command-output-empty', '命令成功但没有返回 JSON', nextAction, EXIT_INVALID_OUTPUT);
  }

  try {
    return normalizePaths(JSON.parse(output));
  } catch {
    emitError(
      'command-output-json-invalid',
      `命令返回了非 JSON 输出：${output.trim()}`,
      nextAction,
      EXIT_INVALID_OUTPUT,
    );
  }
}

export function prepareOpenSpecRepo() {
  requireCommand('openspec', 'openspec-cli-not-found', 'install-openspec');
  requireCommand('node', 'node-cli-not-found', 'install-node');
  return getRepoRoot();
}
