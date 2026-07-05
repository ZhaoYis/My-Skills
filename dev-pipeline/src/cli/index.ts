import { cac } from 'cac';
import { PACKAGE_VERSION } from '../core/runtime/meta.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runInitCommand } from './commands/init.js';
import { runListToolsCommand } from './commands/list-tools.js';
import { runSyncCommand } from './commands/sync.js';
import { runUninstallCommand } from './commands/uninstall.js';
import { runHermesCommand } from './commands/hermes.js';
import { runUpgradeCommand } from './commands/upgrade.js';

export async function runCli(argv: string[]): Promise<void> {
  const cli = cac('opsx-dev-pipeline');
  const dirOption = ['--dir [dir]', 'Target directory', { default: process.cwd() }] as const;

  cli
    .command('init', 'Initialize opsx-dev-pipeline templates in the current directory')
    .option('--tool <tool>', 'Target AI tool id')
    .option('--yes', 'Skip prompts and use defaults/flags')
    .option('--force', 'Overwrite existing files when allowed')
    .option('--dry-run', 'Preview generated files without writing them')
    .option('--feature <feature>', 'Enable an optional feature (e.g. prototype, structural-analysis-hint)')
    .option(...dirOption)
    .action(async (options) => {
      await runInitCommand(options);
    });

  cli
    .command('sync', 'Re-render managed files from opsx-dev-pipeline manifest')
    .option('--yes', 'Skip conflict prompts and preserve existing files when possible')
    .option('--force', 'Overwrite existing managed files')
    .option('--dry-run', 'Preview synchronized files without writing them')
    .option(...dirOption)
    .action(async (options) => {
      await runSyncCommand(options);
    });

  cli
    .command('upgrade', 'Upgrade managed files using the current opsx-dev-pipeline package templates')
    .option('--yes', 'Skip conflict prompts and preserve existing files when possible')
    .option('--force', 'Overwrite existing managed files')
    .option('--dry-run', 'Preview upgraded files without writing them')
    .option(...dirOption)
    .action(async (options) => {
      await runUpgradeCommand(options);
    });

  cli
    .command('uninstall', 'Remove managed files tracked by opsx-dev-pipeline manifest')
    .option('--yes', 'Remove all matched managed files without prompts')
    .option('--dry-run', 'Preview files that would be removed without deleting them')
    .option('--keep-knowledge', 'Keep .knowledge skeleton files on disk')
    .option(...dirOption)
    .action(async (options) => {
      await runUninstallCommand(options);
    });

  cli
    .command('list-tools', 'List supported AI tool adapters')
    .option('--json', 'Print supported tools as JSON')
    .action(async (options) => {
      await runListToolsCommand({ json: Boolean(options.json) });
    });

  cli
    .command('doctor', 'Inspect current directory for opsx-dev-pipeline metadata and .knowledge health')
    .option('--json', 'Print doctor report as JSON')
    .option('--history', 'Persist a health snapshot and report score trend vs the previous snapshot')
    .option('--stale-days <days>', 'Days after which a knowledge file is considered stale (default 90)')
    .option('--stack', 'Only validate the stack profile in openspec/config.yaml')
    .option(...dirOption)
    .action(async (options) => {
      let staleDays: number | undefined;
      if (options.staleDays !== undefined) {
        staleDays = Number(options.staleDays);
        if (!Number.isFinite(staleDays) || staleDays < 1) {
          throw new Error('Invalid --stale-days value. Must be a positive number.');
        }
      }

      const status = await runDoctorCommand(options.dir, Boolean(options.json), {
        history: Boolean(options.history),
        staleDays,
        stackOnly: Boolean(options.stack),
      });

      if (status === 'fail') {
        process.exitCode = 1;
      }
    });

  cli
    .command('hermes <action>', 'Manage Hermes runtime state and skill memory')
    .option('--json', 'Output as JSON')
    .option('--phase <phase>', 'Filter by pipeline phase')
    .option('--category <category>', 'Filter by skill memory category')
    .option(...dirOption)
    .action(async (action, options) => {
      await runHermesCommand(action, options);
    });

  cli.help();
  cli.version(PACKAGE_VERSION);
  await cli.parse(argv);
}
