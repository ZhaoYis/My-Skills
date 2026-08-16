import crypto from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emitError, findOpenSpecRoot, validateChangeName } from './pipeline-lib.mjs';

const EXIT_STATE_NOT_FOUND = 10;
const EXIT_INVALID_TRANSITION = 11;
const EXIT_STATE_IO = 12;
const SCHEMA_VERSION = 3;
const FINGERPRINT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxR/G1SNplC+T3pbvMW06
77fPiNqn9VA7Kg0xCTW39QXwsKgVnQaqlG2cu/kkK2BXgP+SQVVz41Mfwrt7ZqqX
zKFI+5uDPo7seAJa1e1Gyy8X9QOx5KahR8ZAT2qHZzsTt8kRHE5hpFf87E/BO4T7
h1WsRB2CVBrcYryj9SD5pLcDquMf54Nv1QYfziNStiFDPaGDuUmVlUc6GQSv/i/Y
o31rNlo04ct2GClECDv5e2gyHKQ5Jbe+E6He81Svyw74+jHUZzUETXbdQmv5wNhM
cAPXRbQzWgK+LyZrJ3wCEinBfrWVzTRJ2qDX6CZWa1//S1lrpA8VsrMMU7il15HK
tQIDAQAB
-----END PUBLIC KEY-----`;

const mutablePaths = new Set([
  'sourceBranch',
  'targetBranch',
  'executionMode',
  'route',
  'featureInfo',
  'featureInfo.featureId',
  'featureInfo.featureUrl',
  'archivePath',
  'review.reportPath',
  'tests.command',
  'tests.status',
  'tests.detail',
  'verify.command',
  'verify.status',
  'verify.detail',
  'delivery.commitSha',
  'delivery.mergeCommitSha',
  'delivery.sourcePushed',
  'delivery.targetPushed',
  'delivery.tag',
]);

const executionModes = new Set(['pipeline', 'standalone', 'hybrid']);

// Route 分级：trivial（简单变更）、standard（标准变更）、full（复杂变更）
const routeTypes = new Set(['trivial', 'standard', 'full']);

// 各 Route 对应的 Phase 路径
const routePhasePaths = {
  trivial: [0, 2, 6],
  standard: [0, 1, 2, 3, 6],
  full: [0, 1, 2, 3, 4, 5, 6, 7],
};

const PRIVATE_STATE_FIELDS = new Set([
  'createdByEmail',
  'machineInfo',
  'hostname',
  'os',
  'node',
  'arch',
]);

function output(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

function stateRoot(root) {
  return path.join(root, 'openspec', '.pipeline-state');
}

function statePath(root, changeName) {
  return path.join(stateRoot(root), `${changeName}.json`);
}

function diskVersion(state) {
  return Number.isInteger(state?._version) ? state._version : 0;
}

function rememberReadVersion(state) {
  Object.defineProperty(state, '_readVersion', {
    value: diskVersion(state),
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return state;
}

function resolveCreatedBy(value) {
  const identifier = String(value || 'pipeline-actor').trim();
  return identifier && !identifier.includes('@') ? identifier : 'pipeline-actor';
}

function sanitizeState(value) {
  if (Array.isArray(value)) return value.map(sanitizeState);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_STATE_FIELDS.has(key))
      .map(([key, item]) => [key, sanitizeState(item)]),
  );
}

function formatLocalTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function canonicalizeFingerprintFields(fields) {
  return JSON.stringify({
    schemaVersion: fields.schemaVersion,
    changeName: fields.changeName,
    createdAt: fields.createdAt,
    createdBy: fields.createdBy,
    featureId: fields.featureId || '',
    fingerprintNonce: fields.fingerprintNonce,
  });
}

function computeFingerprint(fields) {
  const digest = crypto
    .createHash('sha256')
    .update(canonicalizeFingerprintFields(fields), 'utf8')
    .digest();
  const ciphertext = crypto.publicEncrypt(
    {
      key: FINGERPRINT_PUBLIC_KEY_PEM,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    digest,
  );
  return `fp1.${ciphertext.toString('base64url')}`;
}

function fingerprintFieldsFromState(state) {
  return {
    schemaVersion: state.schemaVersion,
    changeName: state.changeName,
    createdAt: state.createdAt,
    createdBy: resolveCreatedBy(state.createdBy),
    featureId: state.featureInfo?.featureId || '',
    fingerprintNonce: state.fingerprintNonce,
  };
}

function isCurrentFingerprintId(value) {
  if (typeof value !== 'string' || !/^fp1\.[A-Za-z0-9_-]{342}$/.test(value)) return false;
  return Buffer.from(value.slice('fp1.'.length), 'base64url').length === 256;
}

function hasRefreshableFingerprint(state) {
  return (
    state &&
    typeof state === 'object' &&
    Number.isInteger(state.schemaVersion) &&
    typeof state.changeName === 'string' &&
    state.changeName.length > 0 &&
    typeof state.createdAt === 'string' &&
    state.createdAt.length > 0 &&
    typeof state.fingerprintNonce === 'string' &&
    state.fingerprintNonce.length > 0
  );
}

async function refreshFingerprints(root, dryRun) {
  const directory = stateRoot(root);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      output({
        status: 'ok',
        reason: 'pipeline-state-directory-not-found',
        detected: 0,
        compliant: 0,
        eligible: 0,
        refreshed: 0,
        skipped: 0,
        dryRun,
      });
      return;
    }
    emitError(
      'pipeline-state-scan-failed',
      `无法扫描流水线状态目录：${String(error)}`,
      'check-pipeline-state-directory',
      EXIT_STATE_IO,
    );
    return;
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
  const states = [];
  for (const file of files) {
    try {
      states.push({ file, state: JSON.parse(await readFile(file, 'utf8')) });
    } catch (error) {
      emitError(
        'pipeline-state-invalid',
        `无法读取流水线状态 ${path.basename(file)}：${String(error)}`,
        'repair-state-file-and-retry-upgrade',
        EXIT_STATE_IO,
      );
      return;
    }
  }

  const compliant = states.filter(
    ({ state }) =>
      isCurrentFingerprintId(state?.fingerprintId) &&
      !Object.keys(state).some((key) => PRIVATE_STATE_FIELDS.has(key)),
  );
  const refreshable = states.filter(
    ({ state }) =>
      (!isCurrentFingerprintId(state?.fingerprintId) ||
        Object.keys(state).some((key) => PRIVATE_STATE_FIELDS.has(key))) &&
      hasRefreshableFingerprint(state),
  );
  const updates = refreshable.map(({ file, state }) => {
    const sanitized = sanitizeState({ ...state, createdBy: resolveCreatedBy(state.createdBy) });
    return {
      file,
      state: {
        ...sanitized,
        fingerprintId: computeFingerprint(fingerprintFieldsFromState(sanitized)),
      },
    };
  });

  if (!dryRun) {
    for (const { file, state } of updates) {
      const temporary = `${file}.${process.pid}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
        await rename(temporary, file);
      } catch (error) {
        emitError(
          'pipeline-state-write-failed',
          `无法更新流水线状态 ${path.basename(file)}：${String(error)}`,
          'check-file-permissions-and-retry-upgrade',
          EXIT_STATE_IO,
        );
        return;
      }
    }
  }

  output({
    status: 'ok',
    reason: dryRun ? 'fingerprint-refresh-preview' : 'fingerprints-refreshed',
    detected: states.length,
    compliant: compliant.length,
    eligible: refreshable.length,
    refreshed: dryRun ? 0 : updates.length,
    skipped: states.length - compliant.length - refreshable.length,
    dryRun,
  });
}

function ensureMetaFields(state) {
  const needsFingerprintRefresh = Object.keys(state).some((key) => PRIVATE_STATE_FIELDS.has(key));
  state.createdBy = resolveCreatedBy(state.createdBy);
  if (!state.featureInfo) state.featureInfo = null;
  if (!state.fingerprintId) state.fingerprintId = '';
  if (!state.fingerprintNonce) state.fingerprintNonce = '';
  const sanitized = sanitizeState(state);
  Object.defineProperty(sanitized, '_needsFingerprintRefresh', {
    value: needsFingerprintRefresh,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return sanitized;
}

async function tryReadState(root, changeName) {
  try {
    return JSON.parse(await readFile(statePath(root, changeName), 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function loadState(root, changeName) {
  try {
    const state = await tryReadState(root, changeName);
    if (!state) {
      emitError(
        'pipeline-state-not-found',
        `找不到 change ${changeName} 的流水线状态`,
        'initialize-or-reconstruct-state',
        EXIT_STATE_NOT_FOUND,
      );
      return null;
    }
    return rememberReadVersion(ensureMetaFields(state));
  } catch (error) {
    emitError(
      'pipeline-state-invalid',
      `无法读取流水线状态：${String(error)}`,
      'repair-state-file',
      EXIT_STATE_IO,
    );
    return null;
  }
}

async function saveState(root, state) {
  const target = statePath(root, state.changeName);
  const directory = path.dirname(target);
  const temporary = `${target}.${process.pid}.tmp`;

  let currentOnDisk;
  try {
    currentOnDisk = await tryReadState(root, state.changeName);
  } catch (error) {
    emitError(
      'pipeline-state-invalid',
      `无法检查流水线状态版本：${String(error)}`,
      'repair-state-file',
      EXIT_STATE_IO,
    );
    return false;
  }

  const readVersion = state._readVersion;
  if (
    (currentOnDisk && readVersion === undefined) ||
    (!currentOnDisk && readVersion !== undefined) ||
    (currentOnDisk && diskVersion(currentOnDisk) !== readVersion)
  ) {
    emitError(
      'pipeline-state-concurrent-modification',
      `状态文件已被其他会话修改（读取版本: ${readVersion ?? 'none'}，磁盘版本: ${
        currentOnDisk ? diskVersion(currentOnDisk) : 'none'
      }）`,
      'reload-state-and-retry',
      EXIT_STATE_IO,
    );
    return false;
  }

  state._version = diskVersion(state) + 1;
  state.updatedAt = formatLocalTime();
  if (state._needsFingerprintRefresh && hasRefreshableFingerprint(state)) {
    state.fingerprintId = computeFingerprint(fingerprintFieldsFromState(state));
  }
  const persistedState = sanitizeState(state);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, `${JSON.stringify(persistedState, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
    rememberReadVersion(state);
  } catch (error) {
    emitError(
      'pipeline-state-write-failed',
      `无法写入流水线状态：${String(error)}`,
      'check-file-permissions',
      EXIT_STATE_IO,
    );
    return false;
  }
  return true;
}

function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function setNested(target, dottedPath, value) {
  const segments = dottedPath.split('.');
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    if (!cursor[segment] || typeof cursor[segment] !== 'object') cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = value;
}

function allowedTransition(from, to, state) {
  const route = state.route || 'standard';
  const routePath = routePhasePaths[route] || routePhasePaths.standard;
  const fromIndex = routePath.indexOf(from);
  const toIndex = routePath.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) return false;
  if (from === to) return true;
  if (to > from && route !== 'full') return toIndex === fromIndex + 1;

  const allowed = {
    0: [0, 1],
    1: [1, 2],
    2: [1, 2, 3, 4],
    3: [2, 3, 4],
    4: [2, 4, 5],
    5: [1, 2, 5, 6],
    6: [6, 7],
    7: [7],
  };

  if (allowed[from]?.includes(to)) return true;
  return route === 'full' && to > from;
}

function hasPassedReview(state) {
  return (
    state.review?.status === 'passed' ||
    state.review?.rounds?.at(-1)?.status === 'passed'
  );
}

function validateGates(state, from, to) {
  const route = state.route || 'standard';

  if (route === 'trivial') {
    if (from === 2 && to === 6) {
      if (state.decisions.implementationConfirmed !== true) {
        return ['implementation-confirmation-required', '离开 Phase2 前必须确认实施摘要'];
      }
      if (!['merge', 'push-only', 'local-only'].includes(state.decisions.postArchiveAction)) {
        return ['post-archive-decision-required', '进入 Phase6 前必须记录归档后交付方式'];
      }
    }
    return null;
  }

  if (to === 2 && state.decisions.proposalApproved !== true) {
    return ['proposal-approval-required', '进入 Phase2 前必须记录 proposalApproved=true'];
  }
  if (from === 2 && to >= 3 && state.decisions.implementationConfirmed !== true) {
    return ['implementation-confirmation-required', '离开 Phase2 前必须确认实施摘要'];
  }

  if (route === 'standard' && from === 3 && to === 6) {
    if (!hasPassedReview(state)) {
      return ['review-gate-required', '进入 Phase6 前必须记录 review passed'];
    }
    if (!['merge', 'push-only', 'local-only'].includes(state.decisions.postArchiveAction)) {
      return ['post-archive-decision-required', '进入 Phase6 前必须记录归档后交付方式'];
    }
    return null;
  }

  if (route === 'full') {
    if (to === 5 && !['passed', 'skipped', 'debt-recorded'].includes(state.tests.status)) {
      return ['test-gate-required', '进入 Phase5 前必须记录测试通过、显式跳过或技术债务'];
    }
    if (to === 6) {
      if (!['passed', 'skipped'].includes(state.verify.status)) {
        return ['verify-gate-required', '进入 Phase6 前必须记录 verify 通过或经用户确认跳过'];
      }
      if (!state.archivePath) {
        return ['archive-required', '进入 Phase6 前必须记录归档路径'];
      }
      if (!['merge', 'push-only', 'local-only'].includes(state.decisions.postArchiveAction)) {
        return ['post-archive-decision-required', '进入 Phase6 前必须记录归档后交付方式'];
      }
    }
    if (to === 7) {
      if (state.decisions.postArchiveAction !== 'merge') {
        return ['merge-gate-required', '进入 Phase7 前必须记录 postArchiveAction=merge'];
      }
      if (!state.delivery.commitSha) {
        return ['commit-required', '进入 Phase7 前必须记录 delivery.commitSha'];
      }
      if (!state.delivery.sourcePushed) {
        return ['source-push-required', '进入 Phase7 前必须推送源分支'];
      }
    }
  }
  return null;
}

function validateTransitionGates(state, from, to) {
  if ((state.route || 'standard') !== 'full' || to <= from) {
    return validateGates(state, from, to);
  }
  for (let phase = from + 1; phase <= to; phase += 1) {
    const gateError = validateGates(state, phase - 1, phase);
    if (gateError) return gateError;
  }
  return null;
}

function migrateReviewToV3(state) {
  if (!Array.isArray(state.review?.rounds)) {
    const oldRound = Number(state.review?.round ?? 0);
    const oldStatus = String(state.review?.status ?? 'pending');
    const oldReportPath = state.review?.reportPath || null;
    const rounds = [];

    if (oldRound > 0 && oldStatus !== 'pending') {
      rounds.push({
        round: oldRound,
        reportPath: oldReportPath,
        status: oldStatus,
        timestamp: state.updatedAt || formatLocalTime(),
        decisions: { ...(state.decisions || {}) },
      });
    }

    state.review = {
      currentRound: oldRound,
      rounds,
      reportPath: null,
      status: oldStatus,
    };
  }

  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

function migrateToLatestSchema(state) {
  state._version = diskVersion(state);
  state.executionMode = state.executionMode || 'pipeline';
  state.route = state.route || 'standard';
  state.phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
  state.gatesBypassed = Array.isArray(state.gatesBypassed) ? state.gatesBypassed : [];
  return migrateReviewToV3(ensureMetaFields(state));
}

function parseInitArgs(args) {
  const sourceBranch = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const namedArgs = {};
  const namedStart = sourceBranch ? 1 : 0;
  const booleanArgs = new Set(['--skip-feature-association']);

  for (let index = namedStart; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (booleanArgs.has(key)) {
      namedArgs[key] = true;
    } else if (key.startsWith('--') && value && !value.startsWith('--')) {
      namedArgs[key] = value;
      index += 1;
    }
  }

  return { sourceBranch, namedArgs };
}

// 根据 Route 验证 Phase 转移是否合法
function isRoutePhaseAllowed(route, fromPhase, toPhase) {
  const routePath = routePhasePaths[route] || routePhasePaths.standard;
  const fromIndex = routePath.indexOf(fromPhase);
  const toIndex = routePath.indexOf(toPhase);

  // 如果目标 Phase 不在 Route 路径中，不允许
  if (toIndex === -1) return false;

  // 如果当前 Phase 不在 Route 路径中，允许（可能是从旧状态迁移）
  if (fromIndex === -1) return true;

  // 允许向前跳转（跨多个 Phase）或向后跳转（用于返工）
  // Gate 验证会确保中间步骤的条件得到满足
  return true;
}

function recordPipelineTransition(state, fromPhase, fromStep, toPhase, toStep, now) {
  const findPipelineInProgress = (phase) =>
    state.phaseHistory.find(
      (entry) =>
        entry.phase === phase && entry.executedBy === 'pipeline' && entry.status === 'in-progress',
    );

  if (fromPhase === toPhase) {
    const currentEntry = findPipelineInProgress(toPhase);
    if (currentEntry) {
      currentEntry.step = toStep;
      currentEntry.decisions = { ...state.decisions };
      return;
    }
  } else {
    const previousEntry = findPipelineInProgress(fromPhase);
    if (previousEntry) {
      previousEntry.step = fromStep;
      previousEntry.status = 'completed';
      previousEntry.completedAt = now;
      previousEntry.decisions = { ...state.decisions };
    } else {
      state.phaseHistory.push({
        phase: fromPhase,
        step: fromStep,
        executedBy: 'pipeline',
        status: 'completed',
        startedAt: now,
        completedAt: now,
        decisions: { ...state.decisions },
        gatesBypassed: [],
      });
    }
  }

  if (!findPipelineInProgress(toPhase)) {
    state.phaseHistory.push({
      phase: toPhase,
      step: toStep,
      executedBy: 'pipeline',
      status: 'in-progress',
      startedAt: now,
      completedAt: null,
      decisions: { ...state.decisions },
      gatesBypassed: [],
    });
  }
}

const attemptRules = {
  review: {
    statuses: ['passed', 'issues-found'],
    failureStatus: 'issues-found',
    counter: 'currentRound',
  },
  tests: { statuses: ['passed', 'failed'], failureStatus: 'failed', counter: 'attempts' },
  verify: { statuses: ['passed', 'failed'], failureStatus: 'failed', counter: 'attempts' },
};

const [command, ...commandArgs] = process.argv.slice(2);
if (!command) {
  emitError(
    'missing-command',
    '用法：dev-pipeline-state.mjs <init|get|decision|set|attempt|record-phase|migrate-schema|transition|pause|complete> <change>，或 refresh-fingerprints <project-root> [--dry-run]',
    'provide-state-command',
    EXIT_INVALID_TRANSITION,
  );
} else {
  const [changeName, ...args] = commandArgs;
  const refreshAllFingerprints = command === 'refresh-fingerprints';
  let root;
  if (refreshAllFingerprints) {
    if (!changeName) {
      emitError(
        'missing-project-root',
        'refresh-fingerprints 需要项目根目录',
        'provide-project-root',
        EXIT_INVALID_TRANSITION,
      );
    }
    root = path.resolve(changeName);
  } else {
    validateChangeName(changeName, EXIT_INVALID_TRANSITION);
    root = findOpenSpecRoot();
  }
  if (root) {
    if (refreshAllFingerprints) {
      await refreshFingerprints(root, args.includes('--dry-run'));
    } else if (command === 'init') {
      let existingState = null;
      try {
        existingState = await tryReadState(root, changeName);
      } catch (error) {
        emitError(
          'pipeline-state-invalid',
          `已有状态无法解析：${String(error)}`,
          'repair-state-file',
          EXIT_STATE_IO,
        );
      }

      if (existingState) {
        output({ status: 'ok', reason: 'pipeline-state-already-exists', state: existingState });
      } else if (process.exitCode === undefined) {
        const { sourceBranch, namedArgs } = parseInitArgs(args);
        const createdBy = resolveCreatedBy(namedArgs['--created-by']);
        const featureId = namedArgs['--feature-id'] || null;
        const featureUrl = namedArgs['--feature-url'] || null;
        const skipFeatureAssociation = namedArgs['--skip-feature-association'] === true;

        if (featureUrl && !featureId) {
          emitError(
            'feature-id-required',
            '提供 --feature-url 时必须同时提供 --feature-id',
            'provide-feature-id',
            EXIT_INVALID_TRANSITION,
          );
        } else if (skipFeatureAssociation && (featureId || featureUrl)) {
          emitError(
            'feature-association-options-conflict',
            '--skip-feature-association 不能与需求关联参数同时使用',
            'provide-feature-or-explicit-skip',
            EXIT_INVALID_TRANSITION,
          );
        } else if (!featureId && !skipFeatureAssociation) {
          emitError(
            'feature-association-decision-required',
            '首次创建状态前必须由用户明确选择关联外部需求或跳过关联',
            'provide-feature-id-or-skip-feature-association',
            EXIT_INVALID_TRANSITION,
          );
        } else {
          const now = formatLocalTime();
          const nonce = crypto.randomBytes(4).toString('hex');
          const route = namedArgs['--route'] || 'standard';
          if (!routeTypes.has(route)) {
            emitError(
              'invalid-route',
              `无效的 Route 类型：${route}，允许值：trivial, standard, full`,
              'provide-valid-route',
              EXIT_INVALID_TRANSITION,
            );
          } else {
          const state = {
            schemaVersion: SCHEMA_VERSION,
            _version: 0,
            changeName,
            sourceBranch,
            targetBranch: null,
            currentPhase: 0,
            currentStep: 1,
            status: 'active',
            executionMode: 'pipeline',
            route,
            createdBy,
            featureInfo: featureId ? { featureId, featureUrl } : null,
            fingerprintId: computeFingerprint({
              schemaVersion: SCHEMA_VERSION,
              changeName,
              createdAt: now,
              createdBy,
              featureId,
              fingerprintNonce: nonce,
            }),
            fingerprintNonce: nonce,
            phaseHistory: [
              {
                phase: 0,
                step: 1,
                executedBy: 'pipeline',
                status: 'in-progress',
                startedAt: now,
                completedAt: null,
                decisions: {},
                gatesBypassed: [],
              },
            ],
            gatesBypassed: [],
            decisions: {},
            review: {
              currentRound: 0,
              rounds: [],
              reportPath: null,
              status: 'pending',
            },
            tests: { command: null, attempts: 0, status: 'pending', detail: null },
            verify: { command: null, attempts: 0, status: 'pending', detail: null },
            archivePath: null,
            delivery: {
              commitSha: null,
              mergeCommitSha: null,
              sourcePushed: false,
              targetPushed: false,
              tag: null,
            },
            createdAt: now,
            updatedAt: now,
          };
          if (await saveState(root, state)) output({ status: 'ok', state });
          }
        }
      }
    } else {
      const state = await loadState(root, changeName);
      if (state) {
        if (command === 'get') {
          output({ status: 'ok', state });
        } else if (command === 'migrate-schema') {
          if (state.schemaVersion === SCHEMA_VERSION) {
            output({ status: 'ok', reason: 'already-v3', state });
          } else if (!args.includes('--confirm')) {
            output({
              status: 'prompt',
              reason: 'migration-requires-confirmation',
              detail:
                '旧版 Schema 状态需要用户确认后才能升级到 v3；使用 --confirm 保留原数据，并将 review 转换为 rounds 集合。',
              state,
            });
          } else {
            migrateToLatestSchema(state);
            if (await saveState(root, state)) {
              output({ status: 'ok', reason: 'schema-migrated', state });
            }
          }
        } else if (command === 'record-phase') {
          if (state.schemaVersion !== SCHEMA_VERSION) {
            emitError(
              'pipeline-state-migration-required',
              'record-phase 仅支持 Schema v3，请先确认迁移状态文件',
              'run-migrate-schema-with-confirmation',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            const phase = Number(args[0]);
            const step = Number(args[1]);
            const executedBy = args[2];
            const flagsAndGates = args.slice(3);
            const start = flagsAndGates.includes('--start');
            const abandon = flagsAndGates.includes('--abandon');
            const bypassedGates = flagsAndGates.filter(
              (value) => value !== '--start' && value !== '--abandon',
            );

            if (
              !Number.isInteger(phase) ||
              phase < 0 ||
              phase > 7 ||
              !Number.isInteger(step) ||
              !executedBy
            ) {
              emitError(
                'invalid-phase-record',
                'record-phase 需要 Phase 0-7、整数 Step 和 executed-by',
                'provide-valid-phase-record',
                EXIT_INVALID_TRANSITION,
              );
            } else {
              const now = formatLocalTime();
              let entry = !start
                ? state.phaseHistory.find(
                    (candidate) =>
                      candidate.phase === phase &&
                      candidate.executedBy === executedBy &&
                      candidate.status === 'in-progress',
                  )
                : null;
              const completingExisting = Boolean(entry);

              if (!entry) {
                entry = {
                  phase,
                  step,
                  executedBy,
                  status: 'in-progress',
                  startedAt: now,
                  completedAt: null,
                  decisions: { ...state.decisions },
                  gatesBypassed: [],
                };
                state.phaseHistory.push(entry);
              }

              entry.step = step;
              entry.executedBy = executedBy;
              entry.decisions = { ...state.decisions };
              entry.gatesBypassed = Array.from(
                new Set([...(entry.gatesBypassed || []), ...bypassedGates]),
              );

              if (abandon) {
                entry.status = 'abandoned';
                entry.completedAt = now;
              } else if (!start && completingExisting) {
                entry.status = 'completed';
                entry.completedAt = now;
              }

              state.gatesBypassed = Array.from(
                new Set([...(state.gatesBypassed || []), ...bypassedGates]),
              );
              if (await saveState(root, state)) output({ status: 'ok', state });
            }
          }
        } else if (command === 'decision') {
          const [key, rawValue] = args;
          const userConfirmedFlag = args.includes('--user-confirmed');
          const summaryIndex = args.indexOf('--summary');
          const summary = summaryIndex !== -1 ? args[summaryIndex + 1] : null;

          if (!key || rawValue === undefined || !/^[A-Za-z][A-Za-z0-9]*$/.test(key)) {
            emitError(
              'invalid-decision',
              'decision 需要合法 key 和 JSON value',
              'provide-decision',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            state.decisions[key] = parseValue(rawValue);

            // 如果提供了 --user-confirmed 标志，记录用户确认信息
            if (userConfirmedFlag) {
              if (!state.confirmations) {
                state.confirmations = {};
              }
              state.confirmations[key] = {
                userConfirmed: true,
                confirmedAt: formatLocalTime(),
                summary: summary || null,
              };
            }

            if (await saveState(root, state)) output({ status: 'ok', state });
          }
        } else if (command === 'set') {
          const [fieldPath, rawValue] = args;
          const parsedValue = rawValue === undefined ? undefined : parseValue(rawValue);
          const invalidExecutionMode =
            fieldPath === 'executionMode' && !executionModes.has(parsedValue);
          if (!mutablePaths.has(fieldPath) || rawValue === undefined || invalidExecutionMode) {
            emitError(
              'invalid-state-field',
              `不允许修改状态字段或字段值：${fieldPath ?? ''}`,
              'choose-supported-state-field',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            setNested(state, fieldPath, parsedValue);
            if (await saveState(root, state)) output({ status: 'ok', state });
          }
        } else if (command === 'attempt') {
          const [scope, attemptStatus] = args;
          const rule = attemptRules[scope];
          if (!rule?.statuses.includes(attemptStatus)) {
            emitError(
              'invalid-attempt',
              'attempt 需要 scope=review|tests|verify 和对应的合法状态',
              'provide-valid-attempt',
              EXIT_INVALID_TRANSITION,
            );
          } else if (scope === 'review') {
            if (!state.review || typeof state.review !== 'object') state.review = {};
            if (!Array.isArray(state.review.rounds)) {
              state.review.rounds = [];
              state.review.currentRound = Number(state.review.round) || 0;
            }

            const lastRecordedRound = Number(state.review.rounds.at(-1)?.round ?? 0);
            const nextRound =
              Math.max(
                Number(state.review.currentRound) || 0,
                lastRecordedRound,
                state.review.rounds.length,
              ) + 1;
            const reportPath = state.review.reportPath || null;
            state.review.currentRound = nextRound;
            state.review.rounds.push({
              round: nextRound,
              reportPath,
              status: attemptStatus,
              timestamp: formatLocalTime(),
              decisions: { ...(state.decisions || {}) },
            });
            state.review.status = attemptStatus;
            state.review.reportPath = reportPath;

            const lastThree = state.review.rounds.slice(-3);
            const limitReached =
              lastThree.length === 3 &&
              lastThree.every((round) => round.status === rule.failureStatus);
            if (limitReached) {
              state.status = 'paused';
              state.pauseReason = 'review-attempt-limit-reached';
            }
            if (await saveState(root, state)) {
              if (limitReached) {
                output(
                  {
                    status: 'error',
                    reason: 'review-attempt-limit-reached',
                    detail: 'review 已连续记录 3 轮 issues-found，流水线已暂停',
                    nextAction: 'manual-intervention-required',
                    state,
                  },
                  EXIT_INVALID_TRANSITION,
                );
              } else {
                output({ status: 'ok', state });
              }
            }
          } else {
            const currentCount = Number(state[scope][rule.counter] ?? 0);
            state[scope][rule.counter] = currentCount + 1;
            state[scope].status = attemptStatus;
            const limitReached = attemptStatus === rule.failureStatus && currentCount + 1 >= 3;
            if (limitReached) {
              state.status = 'paused';
              state.pauseReason = `${scope}-attempt-limit-reached`;
            }
            if (await saveState(root, state)) {
              if (limitReached) {
                output(
                  {
                    status: 'error',
                    reason: `${scope}-attempt-limit-reached`,
                    detail: `${scope} 已连续记录 3 次未通过结果，流水线已暂停`,
                    nextAction: 'manual-intervention-required',
                    state,
                  },
                  EXIT_INVALID_TRANSITION,
                );
              } else {
                output({ status: 'ok', state });
              }
            }
          }
        } else if (command === 'transition') {
          const toPhase = Number(args[0]);
          const toStep = Number(args[1]);
          const fromPhase = state.currentPhase;
          const fromStep = state.currentStep;
          const route = state.route || 'standard';
          if (
            !Number.isInteger(toPhase) ||
            toPhase < 0 ||
            toPhase > 7 ||
            !Number.isInteger(toStep)
          ) {
            emitError(
              'invalid-transition-target',
              '目标 Phase 必须为 0-7，Step 必须为整数',
              'choose-valid-transition',
              EXIT_INVALID_TRANSITION,
            );
          } else if (!isRoutePhaseAllowed(route, fromPhase, toPhase)) {
            emitError(
              'route-phase-not-allowed',
              `Route ${route} 不允许从 Phase${fromPhase} 跳转到 Phase${toPhase}。允许的路径：${routePhasePaths[route].join(' -> ')}`,
              'follow-route-phase-path',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            const gateError = validateTransitionGates(state, fromPhase, toPhase);
            if (!allowedTransition(fromPhase, toPhase, state)) {
              if (gateError) {
                emitError(
                  gateError[0],
                  gateError[1],
                  'complete-required-gate',
                  EXIT_INVALID_TRANSITION,
                );
              } else {
                emitError(
                  'pipeline-transition-not-allowed',
                  `不允许从 Phase${fromPhase} 跳转到 Phase${toPhase}`,
                  'follow-pipeline-transitions',
                  EXIT_INVALID_TRANSITION,
                );
              }
            } else if (gateError) {
              emitError(
                gateError[0],
                gateError[1],
                'complete-required-gate',
                EXIT_INVALID_TRANSITION,
              );
            } else {
              state.currentPhase = toPhase;
              state.currentStep = toStep;
              state.status = 'active';
              recordPipelineTransition(
                state,
                fromPhase,
                fromStep,
                toPhase,
                toStep,
                formatLocalTime(),
              );
              if (await saveState(root, state)) output({ status: 'ok', state });
            }
          }
        } else if (command === 'pause') {
          state.status = 'paused';
          state.pauseReason = args.join(' ') || 'user-requested';
          if (await saveState(root, state)) output({ status: 'ok', state });
        } else if (command === 'complete') {
          if (state.currentPhase !== 6 && state.currentPhase !== 7) {
            emitError(
              'pipeline-not-delivered',
              '只有 Phase6 或 Phase7 可以标记流水线完成',
              'finish-delivery-phase',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            state.status = 'completed';
            if (await saveState(root, state)) output({ status: 'ok', state });
          }
        } else {
          emitError(
            'unknown-state-command',
            `未知状态命令：${command}`,
            'choose-supported-state-command',
            EXIT_INVALID_TRANSITION,
          );
        }
      }
    }
  }
}
