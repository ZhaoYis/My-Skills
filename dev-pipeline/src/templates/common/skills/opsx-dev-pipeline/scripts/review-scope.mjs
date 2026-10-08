import {
  emitEvidence,
  evidenceFailure,
  git,
  isAncestor,
  loadEvidenceState,
  optionalGit,
  resolveCommit,
} from './git-evidence-lib.mjs';
import { emitError } from './pipeline-lib.mjs';

const [changeName, flag, suppliedBase, ...extra] = process.argv.slice(2);
if ((flag && flag !== '--base') || (flag && !suppliedBase) || extra.length) {
  emitError(
    'invalid-review-arguments',
    '用法：review-scope.mjs <change> [--base <ref>]',
    'choose-review-base',
    4,
  );
}
const { root, state } = loadEvidenceState(changeName);
try {
  const headCommit = optionalGit(root, ['rev-parse', '--verify', 'HEAD']);
  const selectedBase = suppliedBase || state.review?.baseCommit;
  const initialEmpty = state.review?.baseEmpty === true;
  if (!selectedBase && !initialEmpty) {
    emitError(
      'review-baseline-required',
      '旧状态缺少审查基线，必须选择并记录基准 commit',
      'choose-review-base',
      4,
    );
  }
  const baseCommit = selectedBase ? resolveCommit(root, selectedBase) : null;
  if (baseCommit && (!headCommit || !isAncestor(root, baseCommit, headCommit))) {
    emitError(
      'review-baseline-not-ancestor',
      '基准已不属于当前历史，需重新确认审查基线',
      'choose-review-base',
      4,
    );
  }
  // An empty-tree baseline also covers commits made after an unborn init.
  const emptyTree =
    initialEmpty && headCommit ? git(root, ['hash-object', '-t', 'tree', '--stdin']).trim() : null;
  const diffBase = baseCommit || emptyTree;
  const common = ['--no-ext-diff', '--no-textconv', '--relative'];
  const args = diffBase ? [diffBase] : ['--cached'];
  const diff = git(root, ['diff', ...common, ...args, '--', '.']);
  const trackedFiles = git(root, ['diff', ...common, '--name-only', '-z', ...args, '--', '.'])
    .split('\0')
    .filter(Boolean);
  const untrackedFiles = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.'])
    .split('\0')
    .filter(Boolean)
    .filter((file) => !file.startsWith('openspec/.pipeline-state/'));
  emitEvidence({
    changeName,
    baseCommit,
    headCommit,
    currentBranch: git(root, ['branch', '--show-current']).trim(),
    trackedFiles,
    untrackedFiles,
    diff,
    hasChanges: trackedFiles.length > 0 || untrackedFiles.length > 0,
  });
} catch (error) {
  evidenceFailure(error);
}
