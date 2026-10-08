import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  emitError,
  execCommandSync,
  findOpenSpecRoot,
  validateChangeName,
} from './pipeline-lib.mjs';

export function loadEvidenceState(changeName) {
  validateChangeName(changeName);
  const root = findOpenSpecRoot();
  const file = path.join(root, 'openspec', '.pipeline-state', `${changeName}.json`);
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (!state || typeof state !== 'object' || state.changeName !== changeName) {
      throw new Error('状态内容与 change 名称不一致');
    }
    return { root, state };
  } catch (error) {
    emitError(
      error.code === 'ENOENT' ? 'pipeline-state-not-found' : 'pipeline-state-read-failed',
      error.code === 'ENOENT' ? '状态文件不存在' : error.message,
      'check-pipeline-state',
      error.code === 'ENOENT' ? 10 : 12,
    );
  }
}

export function git(root, args) {
  return execCommandSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
  });
}

export function optionalGit(root, args) {
  try {
    return git(root, args).trim();
  } catch (error) {
    if (error.status === 1 || error.status === 128) return null;
    throw error;
  }
}

export function resolveCommit(root, ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-')) {
    emitError('invalid-git-ref', '必须提供有效的 Git commit 或 ref', 'choose-valid-git-ref', 4);
  }
  try {
    return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
  } catch {
    emitError(
      'git-commit-not-found',
      '无法解析记录的 Git commit 或 ref',
      'choose-valid-git-ref',
      4,
    );
  }
}

export function isAncestor(root, ancestor, descendant) {
  try {
    git(root, ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

export function remoteHead(root, branch) {
  try {
    git(root, ['check-ref-format', '--branch', branch]);
  } catch {
    emitError('invalid-branch', '分支名无效', 'choose-valid-branch', 4);
  }
  try {
    const output = git(root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`]);
    const [sha] = output.trim().split(/\s+/);
    if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('远程分支输出无效');
    return sha;
  } catch (error) {
    if (error.status === 2) return null;
    emitError(
      'remote-query-failed',
      '无法读取 origin 的实际分支，请检查网络或权限',
      'retry-remote-query',
      5,
    );
  }
}

export function emitEvidence(payload) {
  process.stdout.write(`${JSON.stringify({ status: 'ok', ...payload })}\n`);
}

export function evidenceFailure(error) {
  emitError('git-evidence-failed', error.message, 'fetch-origin-and-check-git-state', 5);
}
