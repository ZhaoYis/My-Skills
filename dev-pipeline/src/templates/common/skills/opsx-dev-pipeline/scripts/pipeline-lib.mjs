import { execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const EXIT_DEPENDENCY_MISSING = 1;
const EXIT_NOT_GIT_REPO = 2;
const EXIT_INVALID_INPUT = 4;
const EXIT_COMMAND_FAILED = 5;
const EXIT_INVALID_OUTPUT = 6;
const MAX_BUFFER = 10 * 1024 * 1024;
const MAX_ERROR_DETAIL_LENGTH = 4096;
const CMD_META_CHARS = /([()\][%!^"`<>&|;, *?])/g;
const CMD_SHIM_PATH = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i;

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

function resolveCommand(name) {
  if (name.includes('/') || name.includes('\\')) {
    return commandCandidates(name).find(isExecutable);
  }

  const directories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const directory of directories) {
    for (const candidate of commandCandidates(name)) {
      const resolved = path.join(directory, candidate);
      if (isExecutable(resolved)) return resolved;
    }
  }
  return undefined;
}

function commandExists(name) {
  return Boolean(resolveCommand(name));
}

function escapeCmdCommand(value) {
  return value.replace(CMD_META_CHARS, '^$1');
}

function escapeCmdArgument(value, doubleEscapeMetaChars) {
  // cmd.exe reparses one command string, so quote backslashes before escaping shell metacharacters.
  let escaped = String(value);
  escaped = escaped.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  escaped = escaped.replace(/(?=(\\+?)?)\1$/g, '$1$1');
  escaped = `"${escaped}"`.replace(CMD_META_CHARS, '^$1');
  return doubleEscapeMetaChars ? escaped.replace(CMD_META_CHARS, '^$1') : escaped;
}

function resolveWindowsScriptInvocation(command, args) {
  const normalizedCommand = path.normalize(command);
  const doubleEscapeMetaChars = CMD_SHIM_PATH.test(normalizedCommand);
  const shellCommand = [
    escapeCmdCommand(normalizedCommand),
    ...args.map((arg) => escapeCmdArgument(arg, doubleEscapeMetaChars)),
  ].join(' ');

  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', `"${shellCommand}"`],
    windowsVerbatimArguments: true,
  };
}

export function resolveCommandInvocation(command, args, platform = process.platform) {
  const resolved = resolveCommand(command) || command;
  const extension = path.extname(resolved).toLowerCase();
  if (platform === 'win32' && (extension === '.cmd' || extension === '.bat')) {
    return resolveWindowsScriptInvocation(resolved, args);
  }
  return { command: resolved, args: [...args] };
}

export function execCommandSync(command, args, options) {
  const invocation = resolveCommandInvocation(command, args);
  const invocationOptions = invocation.windowsVerbatimArguments
    ? { ...options, windowsVerbatimArguments: true }
    : options;
  return execFileSync(invocation.command, invocation.args, invocationOptions);
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
    const root = execCommandSync('git', ['rev-parse', '--show-toplevel'], {
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

function isSameDirectory(left, right) {
  try {
    const leftStat = statSync(left);
    const rightStat = statSync(right);
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch {
    const normalize = (value) => {
      const resolved = path.resolve(value);
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return normalize(left) === normalize(right);
  }
}

export function findOpenSpecRoot() {
  let current = process.cwd();
  const gitRoot = getRepoRoot();

  while (true) {
    const openspecDir = path.join(current, 'openspec');
    try {
      const dirStat = statSync(openspecDir);
      if (
        dirStat.isDirectory() &&
        (existsSync(path.join(openspecDir, 'config.yaml')) ||
          existsSync(path.join(openspecDir, 'changes')))
      ) {
        return current;
      }
    } catch {
      // openspec/ doesn't exist at this level, walk up
    }

    if (isSameDirectory(current, gitRoot)) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return gitRoot;
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
    output = execCommandSync(command, commandArgs, {
      cwd: findOpenSpecRoot(),
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
  return findOpenSpecRoot();
}

export function parseRouteConfig(configPath) {
  const defaultRoutes = {
    trivial: { description: '无行为变化的极小变更', phases: [0, 2, 6] },
    standard: { description: '标准变更', phases: [0, 1, 2, 5, 6] },
    full: { description: '高保障变更', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
  };

  if (!existsSync(configPath)) {
    return defaultRoutes;
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    const lines = content.split('\n');
    const routes = {};
    let currentRoute = null;
    let inRoutes = false;
    let inPhases = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'routes:') {
        inRoutes = true;
        continue;
      }

      if (inRoutes && !line.startsWith(' ') && !line.startsWith('\t') && trimmed) {
        inRoutes = false;
        continue;
      }

      if (inRoutes) {
        const routeMatch = line.match(/^ {2}(\w+):\s*$/);
        if (routeMatch) {
          currentRoute = routeMatch[1];
          routes[currentRoute] = { description: '', phases: [] };
          inPhases = false;
          continue;
        }

        if (currentRoute) {
          const descMatch = line.match(/^ {4}description:\s*(.+)$/);
          if (descMatch) {
            routes[currentRoute].description = descMatch[1].replace(/^["']|["']$/g, '');
            continue;
          }

          const phasesMatch = line.match(/^ {4}phases:\s*\[([^\]]+)\]$/);
          if (phasesMatch) {
            routes[currentRoute].phases = phasesMatch[1].split(',').map((p) => parseInt(p.trim(), 10));
            inPhases = false;
            continue;
          }
        }
      }
    }

    if (Object.keys(routes).length === 0) {
      return defaultRoutes;
    }

    return routes;
  } catch {
    return defaultRoutes;
  }
}

export function validateRouteConfig(routes) {
  for (const [routeName, route] of Object.entries(routes)) {
    if (!Array.isArray(route.phases)) {
      emitError(
        'invalid-route-config',
        `Route "${routeName}" 的 phases 必须是数组`,
        'fix-route-config',
        4,
      );
    }

    for (const phase of route.phases) {
      if (!Number.isInteger(phase) || phase < 0 || phase > 7) {
        emitError(
          'invalid-route-config',
          `Route "${routeName}" 的 phases 必须包含 0-7 的整数，发现: ${phase}`,
          'fix-route-config',
          4,
        );
      }
    }

    if (!route.phases.includes(0)) {
      emitError(
        'invalid-route-config',
        `Route "${routeName}" 必须包含 Phase 0（入口）`,
        'fix-route-config',
        4,
      );
    }

    if (!route.phases.includes(6)) {
      emitError(
        'invalid-route-config',
        `Route "${routeName}" 必须包含 Phase 6（提交）`,
        'fix-route-config',
        4,
      );
    }
  }

  return true;
}

export function getRoutePhases(routeName, routes) {
  const route = routes[routeName];
  if (!route) {
    return routes.full.phases;
  }
  return route.phases;
}
