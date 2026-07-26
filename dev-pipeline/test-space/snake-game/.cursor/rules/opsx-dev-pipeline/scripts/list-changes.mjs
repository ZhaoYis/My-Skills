import { prepareOpenSpecRepo, runJsonCommand } from './pipeline-lib.mjs';

const extraArgs = process.argv.slice(2);
prepareOpenSpecRepo();
const result = runJsonCommand(['openspec', 'list', '--json', ...extraArgs], {
  failureReason: 'openspec-list-failed',
  nextAction: 'check-openspec-config',
});
process.stdout.write(`${JSON.stringify(result)}\n`);
