import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { emitError, findOpenSpecRoot, validateChangeName } from './pipeline-lib.mjs';

const EXIT_STATE_NOT_FOUND = 10;
const EXIT_INVALID_TRANSITION = 11;
const EXIT_STATE_IO = 12;
const SCHEMA_VERSION = 2;

const mutablePaths = new Set([
  'sourceBranch',
  'targetBranch',
  'executionMode',
  'featureInfo',
  'featureInfo.featureId',
  'featureInfo.featureUrl',
  'archivePath',
  'review.reportPath',
  'review.status',
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

function output(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

function statePath(root, changeName) {
  return path.join(root, 'openspec', '.pipeline-state', `${changeName}.json`);
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

function resolveCreatedBy() {
  try {
    const name = execSync('git config user.name', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (name) return name;
  } catch {
    // Fall through to local environment identity.
  }

  if (process.env.USER) return process.env.USER;
  try {
    const username = os.userInfo().username;
    if (username) return username;
  } catch {
    // Fall through to hostname.
  }
  return os.hostname() || 'unknown';
}

function resolveCreatedByEmail() {
  try {
    const email = execSync('git config user.email', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (email) return email;
  } catch {
    // An email is optional.
  }
  return '';
}

function collectMachineInfo() {
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    osRelease: os.release(),
    nodeVersion: process.version,
    arch: os.arch(),
  };
}

function formatLocalTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function computeFingerprint(createdAt, createdBy, featureId, nonce) {
  const input = `${createdAt}|${createdBy}|${featureId || ''}|${nonce}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

function ensureMetaFields(state) {
  if (!state.createdBy) state.createdBy = 'unknown';
  if (!state.createdByEmail) state.createdByEmail = '';
  if (!state.machineInfo?.platform) {
    state.machineInfo = {
      platform: state.machineInfo?.platform || 'unknown',
      hostname: state.machineInfo?.hostname || 'unknown',
      osRelease: state.machineInfo?.osRelease || 'unknown',
      nodeVersion: state.machineInfo?.nodeVersion || 'unknown',
      arch: state.machineInfo?.arch || 'unknown',
    };
  }
  if (!state.featureInfo) state.featureInfo = null;
  if (!state.fingerprintId) state.fingerprintId = '';
  if (!state.fingerprintNonce) state.fingerprintNonce = '';
  return state;
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
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
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

function allowedTransition(from, to, executionMode = 'pipeline') {
  const allowed = {
    0: [0, 1],
    1: [1, 2],
    2: [1, 2, 3, 4],
    3: [2, 3, 4],
    4: [4, 5],
    5: [1, 2, 5, 6],
    6: [6],
  };

  if (executionMode === 'pipeline') {
    return allowed[from]?.includes(to) ?? false;
  }
  if (to > from) return true;
  if (to === 1 || to === 2) return true;
  return allowed[from]?.includes(to) ?? false;
}

function hasPhaseInHistory(state, minPhase) {
  return (state.phaseHistory || []).some((entry) => entry.phase >= minPhase);
}

function applyGateInference(state) {
  const mode = state.executionMode || 'pipeline';
  if (mode === 'pipeline') return;

  if (!state.decisions.proposalApproved && hasPhaseInHistory(state, 2)) {
    state.decisions.proposalApproved = true;
  }
  if (!state.decisions.implementationConfirmed && hasPhaseInHistory(state, 3)) {
    state.decisions.implementationConfirmed = true;
  }
}

function validateGates(state, from, to) {
  if (to === 2 && state.decisions.proposalApproved !== true) {
    return ['proposal-approval-required', '进入 Phase2 前必须记录 proposalApproved=true'];
  }
  if (from === 2 && to >= 3 && state.decisions.implementationConfirmed !== true) {
    return ['implementation-confirmation-required', '离开 Phase2 前必须确认实施摘要'];
  }
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
  return null;
}

function migrateToV2(state) {
  state.schemaVersion = SCHEMA_VERSION;
  state._version = diskVersion(state);
  state.executionMode = state.executionMode || 'pipeline';
  state.phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
  state.gatesBypassed = Array.isArray(state.gatesBypassed) ? state.gatesBypassed : [];
  return ensureMetaFields(state);
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
    counter: 'round',
  },
  tests: { statuses: ['passed', 'failed'], failureStatus: 'failed', counter: 'attempts' },
  verify: { statuses: ['passed', 'failed'], failureStatus: 'failed', counter: 'attempts' },
};

const [command, changeName, ...args] = process.argv.slice(2);
if (!command) {
  emitError(
    'missing-command',
    '用法：dev-pipeline-state.mjs <init|get|decision|set|attempt|record-phase|migrate-schema|transition|pause|complete> <change>',
    'provide-state-command',
    EXIT_INVALID_TRANSITION,
  );
} else {
  validateChangeName(changeName, EXIT_INVALID_TRANSITION);
  const root = findOpenSpecRoot();
  if (root) {
    if (command === 'init') {
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
        const createdBy = namedArgs['--created-by'] || resolveCreatedBy();
        const createdByEmail = resolveCreatedByEmail();
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
            createdBy,
            createdByEmail,
            machineInfo: collectMachineInfo(),
            featureInfo: featureId ? { featureId, featureUrl } : null,
            fingerprintId: computeFingerprint(now, createdBy, featureId, nonce),
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
            review: { round: 0, reportPath: null, status: 'pending' },
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
    } else {
      const state = await loadState(root, changeName);
      if (state) {
        if (command === 'get') {
          output({ status: 'ok', state });
        } else if (command === 'migrate-schema') {
          if (state.schemaVersion === SCHEMA_VERSION) {
            output({ status: 'ok', reason: 'already-v2', state });
          } else if (!args.includes('--confirm')) {
            output({
              status: 'prompt',
              reason: 'migration-requires-confirmation',
              detail:
                'Schema v1 状态需要用户确认后才能升级到 v2；使用 --confirm 保留原数据并补齐新字段。',
              state,
            });
          } else {
            migrateToV2(state);
            if (await saveState(root, state)) {
              output({ status: 'ok', reason: 'schema-migrated', state });
            }
          }
        } else if (command === 'record-phase') {
          if (state.schemaVersion !== SCHEMA_VERSION) {
            emitError(
              'pipeline-state-migration-required',
              'record-phase 仅支持 Schema v2，请先确认迁移状态文件',
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
              phase > 6 ||
              !Number.isInteger(step) ||
              !executedBy
            ) {
              emitError(
                'invalid-phase-record',
                'record-phase 需要 Phase 0-6、整数 Step 和 executed-by',
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
              if (state.executionMode === 'pipeline') state.executionMode = 'hybrid';

              if (await saveState(root, state)) output({ status: 'ok', state });
            }
          }
        } else if (command === 'decision') {
          const [key, rawValue] = args;
          if (!key || rawValue === undefined || !/^[A-Za-z][A-Za-z0-9]*$/.test(key)) {
            emitError(
              'invalid-decision',
              'decision 需要合法 key 和 JSON value',
              'provide-decision',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            state.decisions[key] = parseValue(rawValue);
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
          if (
            !Number.isInteger(toPhase) ||
            toPhase < 0 ||
            toPhase > 6 ||
            !Number.isInteger(toStep)
          ) {
            emitError(
              'invalid-transition-target',
              '目标 Phase 必须为 0-6，Step 必须为整数',
              'choose-valid-transition',
              EXIT_INVALID_TRANSITION,
            );
          } else if (!allowedTransition(fromPhase, toPhase, state.executionMode)) {
            emitError(
              'pipeline-transition-not-allowed',
              `不允许从 Phase${fromPhase} 跳转到 Phase${toPhase}`,
              'follow-pipeline-transitions',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            applyGateInference(state);
            const gateError = validateGates(state, fromPhase, toPhase);
            if (gateError) {
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
          if (state.currentPhase !== 6) {
            emitError(
              'pipeline-not-delivered',
              '只有 Phase6 可以标记流水线完成',
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
