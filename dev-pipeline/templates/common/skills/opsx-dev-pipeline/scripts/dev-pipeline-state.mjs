import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emitError, findOpenSpecRoot, validateChangeName } from './pipeline-lib.mjs';

const EXIT_STATE_NOT_FOUND = 10;
const EXIT_INVALID_TRANSITION = 11;
const EXIT_STATE_IO = 12;

const mutablePaths = new Set([
  'sourceBranch',
  'targetBranch',
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

function output(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

function statePath(root, changeName) {
  return path.join(root, 'openspec', '.pipeline-state', `${changeName}.json`);
}

async function loadState(root, changeName) {
  try {
    const raw = await readFile(statePath(root, changeName), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      emitError(
        'pipeline-state-not-found',
        `找不到 change ${changeName} 的流水线状态`,
        'initialize-or-reconstruct-state',
        EXIT_STATE_NOT_FOUND,
      );
    } else {
      emitError(
        'pipeline-state-invalid',
        `无法读取流水线状态：${String(error)}`,
        'repair-state-file',
        EXIT_STATE_IO,
      );
    }
    return null;
  }
}

async function saveState(root, state) {
  const target = statePath(root, state.changeName);
  const directory = path.dirname(target);
  const temporary = `${target}.${process.pid}.tmp`;
  state.updatedAt = new Date().toISOString();
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
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

function allowedTransition(from, to) {
  const allowed = {
    0: [0, 1],
    1: [1, 2],
    2: [1, 2, 3, 4],
    3: [2, 3, 4],
    4: [4, 5],
    5: [1, 2, 5, 6],
    6: [6],
  };
  return allowed[from]?.includes(to) ?? false;
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
    '用法：dev-pipeline-state.mjs <init|get|decision|set|attempt|transition|pause|complete> <change>',
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
        existingState = JSON.parse(await readFile(statePath(root, changeName), 'utf8'));
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
          emitError(
            'pipeline-state-invalid',
            `已有状态无法解析：${String(error)}`,
            'repair-state-file',
            EXIT_STATE_IO,
          );
        }
      }

      if (existingState) {
        output({ status: 'ok', reason: 'pipeline-state-already-exists', state: existingState });
      } else if (process.exitCode === undefined) {
        const now = new Date().toISOString();
        const state = {
          schemaVersion: 1,
          changeName,
          sourceBranch: args[0] || null,
          targetBranch: null,
          currentPhase: 0,
          currentStep: 1,
          status: 'active',
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
    } else {
      const state = await loadState(root, changeName);
      if (state) {
        if (command === 'get') {
          output({ status: 'ok', state });
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
          if (!mutablePaths.has(fieldPath) || rawValue === undefined) {
            emitError(
              'invalid-state-field',
              `不允许修改状态字段：${fieldPath ?? ''}`,
              'choose-supported-state-field',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            setNested(state, fieldPath, parseValue(rawValue));
            if (await saveState(root, state)) output({ status: 'ok', state });
          }
        } else if (command === 'attempt') {
          const [scope, attemptStatus] = args;
          const rule = attemptRules[scope];
          if (!rule || !rule.statuses.includes(attemptStatus)) {
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
          } else if (!allowedTransition(state.currentPhase, toPhase)) {
            emitError(
              'pipeline-transition-not-allowed',
              `不允许从 Phase${state.currentPhase} 跳转到 Phase${toPhase}`,
              'follow-pipeline-transitions',
              EXIT_INVALID_TRANSITION,
            );
          } else {
            const gateError = validateGates(state, state.currentPhase, toPhase);
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
