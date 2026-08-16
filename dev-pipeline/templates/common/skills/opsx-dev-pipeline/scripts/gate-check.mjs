#!/usr/bin/env node
/**
 * gate-check.mjs — 交互式门禁检查脚本
 *
 * 在关键 Phase 转换前运行，检查：
 * 1. 状态前置条件（制品是否完整、decision 是否已设置）
 * 2. 用户确认记录（关键 decision 是否有 userConfirmed 标记）
 *
 * 输出结构化的确认清单，agent 必须将清单展示给用户并获得确认。
 *
 * Exit codes:
 *   0  = 所有门禁通过
 *   10 = 状态不存在
 *   11 = 非法命令或输入
 *   12 = I/O 错误
 *   20 = 缺少用户确认（列出需要确认的项）
 *   21 = 制品不完整
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findOpenSpecRoot, validateChangeName } from './pipeline-lib.mjs';

const EXIT_OK = 0;
const EXIT_STATE_NOT_FOUND = 10;
const EXIT_INVALID_COMMAND = 11;
const EXIT_STATE_IO = 12;
const EXIT_MISSING_CONFIRMATION = 20;
const EXIT_INCOMPLETE_ARTIFACTS = 21;

function output(payload, exitCode = EXIT_OK) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

async function loadState(root, changeName) {
  const statePath = path.join(root, 'openspec', '.pipeline-state', `${changeName}.json`);
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 检查 OpenSpec 制品是否存在
 */
async function checkArtifacts(root, changeName, requiredArtifacts) {
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  const results = [];

  for (const artifact of requiredArtifacts) {
    const artifactPath = path.join(changeDir, artifact.path);
    try {
      await readFile(artifactPath, 'utf8');
      results.push({ artifact: artifact.id, path: artifact.path, exists: true });
    } catch {
      results.push({ artifact: artifact.id, path: artifact.path, exists: false });
    }
  }

  return results;
}

/**
 * 检查某个 decision 是否有用户确认记录
 */
function hasUserConfirmation(state, decisionKey) {
  const confirmations = state.confirmations || {};
  return confirmations[decisionKey] && confirmations[decisionKey].userConfirmed === true;
}

/**
 * 获取 decision 的用户确认信息
 */
function getUserConfirmation(state, decisionKey) {
  const confirmations = state.confirmations || {};
  return confirmations[decisionKey] || null;
}

/**
 * pre-apply 门禁检查（Phase 1 → Phase 2）
 *
 * 检查：
 * 1. proposal.md 存在
 * 2. design.md 存在
 * 3. specs/ 目录下有 spec 文件
 * 4. tasks.md 存在
 * 5. proposalApproved decision 已设置
 * 6. proposalApproved 有用户确认记录
 */
async function checkPreApply(root, state) {
  const changeName = state.changeName;
  const issues = [];
  const confirmations = [];

  // 检查制品
  const artifacts = await checkArtifacts(root, changeName, [
    { id: 'proposal', path: 'proposal.md' },
    { id: 'design', path: 'design.md' },
    { id: 'tasks', path: 'tasks.md' },
  ]);

  for (const artifact of artifacts) {
    if (!artifact.exists) {
      issues.push({
        type: 'missing-artifact',
        severity: 'error',
        artifact: artifact.id,
        message: `制品 ${artifact.id} (${artifact.path}) 不存在`,
      });
    }
  }

  // 检查 specs 目录
  const specsDir = path.join(root, 'openspec', 'changes', changeName, 'specs');
  let hasSpecs = false;
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(specsDir);
    hasSpecs = entries.length > 0;
  } catch {
    hasSpecs = false;
  }
  if (!hasSpecs) {
    issues.push({
      type: 'missing-artifact',
      severity: 'error',
      artifact: 'specs',
      message: 'specs/ 目录为空或不存在',
    });
  }

  // 检查 proposalApproved decision
  if (state.decisions.proposalApproved !== true) {
    issues.push({
      type: 'missing-decision',
      severity: 'error',
      decision: 'proposalApproved',
      message: 'proposalApproved 未设置为 true',
    });
  }

  // 检查 proposalApproved 是否有用户确认
  if (state.decisions.proposalApproved === true && !hasUserConfirmation(state, 'proposalApproved')) {
    confirmations.push({
      type: 'missing-user-confirmation',
      severity: 'error',
      decision: 'proposalApproved',
      message: 'proposalApproved 缺少用户确认记录',
      instruction: '必须使用 AskUserQuestion 向用户展示提案摘要并获得明确批准后，使用 --user-confirmed 参数记录确认',
      questionsToAsk: [
        '提案制品（proposal/design/specs/tasks）是否完整且符合预期？',
        '是否批准此提案并进入实施阶段？',
      ],
    });
  }

  return { issues, confirmations };
}

/**
 * pre-review 门禁检查（Phase 2 → Phase 3）
 *
 * 检查：
 * 1. implementationConfirmed decision 已设置
 * 2. implementationConfirmed 有用户确认记录
 */
async function checkPreReview(root, state) {
  const issues = [];
  const confirmations = [];

  if (state.decisions.implementationConfirmed !== true) {
    issues.push({
      type: 'missing-decision',
      severity: 'error',
      decision: 'implementationConfirmed',
      message: 'implementationConfirmed 未设置为 true',
    });
  }

  if (state.decisions.implementationConfirmed === true && !hasUserConfirmation(state, 'implementationConfirmed')) {
    confirmations.push({
      type: 'missing-user-confirmation',
      severity: 'error',
      decision: 'implementationConfirmed',
      message: 'implementationConfirmed 缺少用户确认记录',
      instruction: '必须使用 AskUserQuestion 向用户展示实施摘要并获得明确确认后，使用 --user-confirmed 参数记录确认',
      questionsToAsk: [
        '实施是否完成？所有任务是否已标记完成？',
        '是否确认提交代码审查？',
      ],
    });
  }

  return { issues, confirmations };
}

/**
 * pre-merge 门禁检查（Phase 6 → Phase 7）
 *
 * 检查：
 * 1. postArchiveAction = merge
 * 2. delivery.commitSha 已设置
 * 3. delivery.sourcePushed = true
 * 4. merge 操作有用户确认记录
 */
async function checkPreMerge(root, state) {
  const issues = [];
  const confirmations = [];

  if (state.decisions.postArchiveAction !== 'merge') {
    issues.push({
      type: 'missing-decision',
      severity: 'error',
      decision: 'postArchiveAction',
      message: 'postArchiveAction 未设置为 merge',
    });
  }

  if (!state.delivery?.commitSha) {
    issues.push({
      type: 'missing-state',
      severity: 'error',
      field: 'delivery.commitSha',
      message: 'delivery.commitSha 未设置',
    });
  }

  if (!state.delivery?.sourcePushed) {
    issues.push({
      type: 'missing-state',
      severity: 'error',
      field: 'delivery.sourcePushed',
      message: 'delivery.sourcePushed 未设置为 true',
    });
  }

  // 合并操作需要用户确认
  if (!hasUserConfirmation(state, 'mergeConfirmed')) {
    confirmations.push({
      type: 'missing-user-confirmation',
      severity: 'error',
      decision: 'mergeConfirmed',
      message: '合并操作缺少用户确认记录',
      instruction: '必须使用 AskUserQuestion 向用户确认合并目标和分支，使用 --user-confirmed 参数记录确认',
      questionsToAsk: [
        '确认要合并到目标分支吗？',
        '源分支和目标分支是否正确？',
      ],
    });
  }

  return { issues, confirmations };
}

/**
 * pre-test-skip 门禁检查
 *
 * 当测试失败需要跳过时，检查用户是否确认跳过
 */
async function checkPreTestSkip(root, state) {
  const issues = [];
  const confirmations = [];

  if (state.tests?.status === 'failed' && !hasUserConfirmation(state, 'testSkipConfirmed')) {
    confirmations.push({
      type: 'missing-user-confirmation',
      severity: 'error',
      decision: 'testSkipConfirmed',
      message: '测试跳过后继续需要用户确认',
      instruction: '测试失败后跳过需要用户明确确认，使用 --user-confirmed 参数记录确认',
      questionsToAsk: [
        '测试失败，是否确认跳过并记录为技术债务？',
        '或者选择修复后重试？',
      ],
    });
  }

  return { issues, confirmations };
}

// ─── 主入口 ────────────────────────────────────────────

const [subcommand, changeName, ...rest] = process.argv.slice(2);

if (!subcommand) {
  output({
    status: 'error',
    reason: 'missing-subcommand',
    detail: '用法：gate-check.mjs <pre-apply|pre-review|pre-merge|pre-test-skip> <change>',
    nextAction: 'provide-subcommand',
  }, EXIT_INVALID_COMMAND);
} else if (!changeName) {
  output({
    status: 'error',
    reason: 'missing-change-name',
    detail: '用法：gate-check.mjs <subcommand> <change>',
    nextAction: 'provide-change-name',
  }, EXIT_INVALID_COMMAND);
} else {
  validateChangeName(changeName, EXIT_INVALID_COMMAND);
  const root = findOpenSpecRoot();

  if (!root) {
    output({
      status: 'error',
      reason: 'openspec-root-not-found',
      detail: '找不到 openspec 根目录',
      nextAction: 'check-project-structure',
    }, EXIT_STATE_IO);
  } else {
    const state = await loadState(root, changeName);

    if (!state) {
      output({
        status: 'error',
        reason: 'pipeline-state-not-found',
        detail: `找不到 change ${changeName} 的流水线状态`,
        nextAction: 'initialize-state-first',
      }, EXIT_STATE_NOT_FOUND);
    } else {
      const checkers = {
        'pre-apply': checkPreApply,
        'pre-review': checkPreReview,
        'pre-merge': checkPreMerge,
        'pre-test-skip': checkPreTestSkip,
      };

      const checker = checkers[subcommand];
      if (!checker) {
        output({
          status: 'error',
          reason: 'unknown-subcommand',
          detail: `未知的门禁检查：${subcommand}，支持：${Object.keys(checkers).join(', ')}`,
          nextAction: 'use-supported-subcommand',
        }, EXIT_INVALID_COMMAND);
      } else {
        const { issues, confirmations } = await checker(root, state);

        const errors = issues.filter(i => i.severity === 'error');
        const warnings = issues.filter(i => i.severity === 'warning');
        const missingConfirmations = confirmations.filter(c => c.severity === 'error');

        if (errors.length > 0) {
          output({
            status: 'blocked',
            reason: 'gate-check-failed',
            subcommand,
            changeName,
            currentPhase: state.currentPhase,
            errors,
            warnings,
            missingConfirmations,
            nextAction: 'resolve-errors-before-proceeding',
          }, errors.some(e => e.type === 'missing-artifact') ? EXIT_INCOMPLETE_ARTIFACTS : EXIT_MISSING_CONFIRMATION);
        } else if (missingConfirmations.length > 0) {
          output({
            status: 'confirmation-required',
            reason: 'user-confirmation-needed',
            subcommand,
            changeName,
            currentPhase: state.currentPhase,
            warnings,
            missingConfirmations,
            nextAction: 'use-AskUserQuestion-to-confirm-then-record-with---user-confirmed',
          }, EXIT_MISSING_CONFIRMATION);
        } else {
          output({
            status: 'passed',
            reason: 'all-gates-passed',
            subcommand,
            changeName,
            currentPhase: state.currentPhase,
            warnings,
          }, EXIT_OK);
        }
      }
    }
  }
}
