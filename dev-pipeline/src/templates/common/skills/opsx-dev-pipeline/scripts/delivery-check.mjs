import path from 'node:path';
import {
  emitEvidence,
  evidenceFailure,
  git,
  isAncestor,
  loadEvidenceState,
  optionalGit,
  remoteHead,
  resolveCommit,
} from './git-evidence-lib.mjs';
import { emitError } from './pipeline-lib.mjs';

const [mode, changeName, ...extra] = process.argv.slice(2);
if (!['final-state', 'merge'].includes(mode) || extra.length) {
  emitError(
    'invalid-delivery-check',
    '用法：delivery-check.mjs <final-state|merge> <change>',
    'choose-delivery-check',
    4,
  );
}
const { root, state } = loadEvidenceState(changeName);
try {
  const action = state.decisions?.postArchiveAction;
  if (!['local-only', 'push-only', 'merge'].includes(action)) {
    emitError('delivery-mode-required', '未记录交付模式', 'choose-delivery-mode', 11);
  }
  const branch = action === 'merge' ? state.targetBranch : state.sourceBranch;
  if (!branch)
    emitError('delivery-branch-required', '未记录交付分支', 'record-delivery-branch', 11);
  if (git(root, ['branch', '--show-current']).trim() !== branch) {
    emitError('delivery-branch-mismatch', '当前分支与交付分支不一致', 'switch-delivery-branch', 11);
  }
  if (mode === 'final-state') {
    const file = path.join('openspec', '.pipeline-state', `${changeName}.json`);
    const finalStateCommitSha = optionalGit(root, ['log', '-1', '--format=%H', '--', file]);
    const message = finalStateCommitSha
      ? git(root, ['show', '-s', '--format=%s', finalStateCommitSha]).trim()
      : '';
    let clean = false;
    let tracked = false;
    try {
      git(root, ['ls-files', '--error-unmatch', '--', file]);
      tracked = true;
      git(root, ['diff', '--quiet', 'HEAD', '--', file]);
      clean = true;
    } catch (error) {
      if (error.status !== 1) throw error;
    }
    const localCommitted =
      state.status === 'completed' &&
      tracked &&
      clean &&
      message === `chore(${changeName}): finalize pipeline delivery state`;
    const remote = action === 'local-only' ? null : remoteHead(root, branch);
    const remoteContains =
      action === 'local-only'
        ? null
        : Boolean(localCommitted && remote && isAncestor(root, finalStateCommitSha, remote));
    emitEvidence({
      branch,
      localCommitted,
      remoteContains,
      finalStateCommitSha,
      remoteHead: remote,
    });
  } else {
    if (action !== 'merge') {
      emitError('merge-mode-required', '该检查只适用于 merge 交付', 'choose-merge-mode', 11);
    }
    const sourceCommitSha = resolveCommit(root, state.delivery?.commitSha);
    const mergeCommitSha = resolveCommit(root, state.delivery?.mergeCommitSha);
    if (typeof state.sourceBranch !== 'string' || !state.sourceBranch) {
      emitError('source-branch-required', '未记录源分支', 'record-source-branch', 11);
    }
    const sourceHead = optionalGit(root, [
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${state.sourceBranch}^{commit}`,
    ]);
    const remoteSource = remoteHead(root, state.sourceBranch);
    if (
      (sourceHead && sourceHead !== sourceCommitSha) ||
      (remoteSource && remoteSource !== sourceCommitSha)
    ) {
      emitError(
        'source-commit-changed',
        '源分支在合并后出现新提交，禁止按旧交付证据清理',
        'review-source-branch',
        11,
      );
    }
    const remote = remoteHead(root, branch);
    const strategy = state.decisions?.mergeStrategy;
    if (!['standard', 'squash', 'no-ff'].includes(strategy)) {
      emitError('merge-strategy-required', '必须记录实际合并策略', 'record-merge-strategy', 11);
    }
    const sourceContained = Boolean(remote && isAncestor(root, sourceCommitSha, remote));
    const canDeleteLocal = Boolean(sourceHead && sourceContained);
    const canDeleteRemote = Boolean(remoteSource && (strategy === 'squash' || sourceContained));
    const delivered =
      Boolean(remote && isAncestor(root, mergeCommitSha, remote)) &&
      (strategy === 'squash' || sourceContained);
    if (!delivered) {
      emitError(
        'merge-not-delivered',
        '实际远程目标分支尚未包含记录的合并结果',
        'push-target-branch',
        11,
      );
    }
    emitEvidence({
      delivered,
      canDeleteLocal,
      canDeleteRemote,
      sourceBranchExists: Boolean(sourceHead),
      remoteSourceExists: Boolean(remoteSource),
      sourceCommitSha,
      mergeCommitSha,
      remoteHead: remote,
      evidence: strategy === 'squash' ? 'recorded-squash-commit' : 'source-ancestry',
    });
  }
} catch (error) {
  evidenceFailure(error);
}
