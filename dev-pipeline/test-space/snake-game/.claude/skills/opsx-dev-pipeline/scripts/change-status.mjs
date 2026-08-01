import {
  emitError,
  prepareOpenSpecRepo,
  runJsonCommand,
  validateChangeName,
} from './pipeline-lib.mjs';

const [name] = process.argv.slice(2);
if (!name) {
  emitError('missing-argument', '缺少必需参数：change-name', 'provide-required-argument', 4);
}

validateChangeName(name);
prepareOpenSpecRepo();
const result = runJsonCommand(['openspec', 'status', '--change', name, '--json'], {
  failureReason: 'openspec-status-failed',
  nextAction: 'check-change-name',
});
process.stdout.write(`${JSON.stringify(result)}\n`);
