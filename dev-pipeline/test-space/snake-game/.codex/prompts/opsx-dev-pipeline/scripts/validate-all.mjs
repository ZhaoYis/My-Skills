import { prepareOpenSpecRepo, runJsonCommand } from './pipeline-lib.mjs';

const extraArgs = process.argv.slice(2);
prepareOpenSpecRepo();
const result = runJsonCommand(
  ['openspec', 'validate', '--all', '--json', '--no-interactive', ...extraArgs],
  {
    failureReason: 'openspec-validate-all-failed',
    nextAction: 'fix-validation-errors',
  },
);
process.stdout.write(`${JSON.stringify(result)}\n`);
