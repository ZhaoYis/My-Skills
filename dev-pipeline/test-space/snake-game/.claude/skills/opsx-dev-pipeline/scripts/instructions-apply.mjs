import {
  emitError,
  prepareOpenSpecRepo,
  runJsonCommand,
  validateChangeName,
} from './pipeline-lib.mjs';

const [change] = process.argv.slice(2);
if (!change) {
  emitError('missing-argument', '缺少必需参数：change-name', 'provide-required-argument', 4);
}

validateChangeName(change);
prepareOpenSpecRepo();
const result = runJsonCommand(['openspec', 'instructions', 'apply', '--change', change, '--json'], {
  failureReason: 'openspec-apply-instructions-failed',
  nextAction: 'check-change-artifacts',
});
process.stdout.write(`${JSON.stringify(result)}\n`);
