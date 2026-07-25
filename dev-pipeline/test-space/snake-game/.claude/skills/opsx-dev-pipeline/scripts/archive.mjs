import {
  emitError,
  prepareOpenSpecRepo,
  runJsonCommand,
  validateChangeName,
} from './pipeline-lib.mjs';

const [name, ...extraArgs] = process.argv.slice(2);
if (!name) {
  emitError('missing-argument', '缺少必需参数：change-name', 'provide-required-argument', 4);
}

validateChangeName(name);
prepareOpenSpecRepo();
const result = runJsonCommand(['openspec', 'archive', name, '--json', ...extraArgs], {
  failureReason: 'openspec-archive-failed',
  nextAction: 'fix-validation-or-pending-tasks',
});
process.stdout.write(`${JSON.stringify(result)}\n`);
