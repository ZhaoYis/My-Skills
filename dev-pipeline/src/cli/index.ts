import { cac } from 'cac';
import { runDoctorCommand } from './commands/doctor.js';
import { runInitCommand } from './commands/init.js';
import { runListToolsCommand } from './commands/list-tools.js';
import { runSyncCommand } from './commands/sync.js';
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
    .command('list-tools', 'List supported AI tool adapters')
    .action(async () => {
      await runListToolsCommand();
    });

  cli
    .command('doctor', 'Inspect current directory for opsx-dev-pipeline metadata and .knowledge health')
    .option('--json', 'Print doctor report as JSON')
    .option('--history', 'Persist a health snapshot and report score trend vs the previous snapshot')
    .option('--stale-days <days>', 'Days after which a knowledge file is considered stale (default 90)')
    .option(...dirOption)
    .action(async (options) => {
      const staleDays = options.staleDays === undefined ? undefined : Number(options.staleDays);
      await runDoctorCommand(options.dir, Boolean(options.json), {
        history: Boolean(options.history),
        staleDays: Number.isFinite(staleDays) ? staleDays : undefined
      });
    });

  cli.help();
  cli.version('0.1.0');
  await cli.parse(argv);
}
