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
const result = runJsonCommand(
  ['openspec', 'validate', name, '--type', 'change', '--json', '--no-interactive', ...extraArgs],
  {
    failureReason: 'openspec-validate-change-failed',
    nextAction: 'fix-change-artifacts',
  },
);
process.stdout.write(`${JSON.stringify(result)}\n`);
