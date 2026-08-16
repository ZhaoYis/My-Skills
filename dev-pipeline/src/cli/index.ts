import { cac } from 'cac';
import { PACKAGE_VERSION } from '../core/runtime/meta.js';
import { runConfigEffectiveCommand } from './commands/config.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runInitCommand } from './commands/init.js';
import { runKnowledgeSelectCommand } from './commands/knowledge.js';
import { runListToolsCommand } from './commands/list-tools.js';
import { runSyncCommand } from './commands/sync.js';
import { runUninstallCommand } from './commands/uninstall.js';
import { runUpgradeCommand } from './commands/upgrade.js';

export async function runCli(argv: string[]): Promise<void> {
  const cli = cac('opsx-dev-pipeline');
  const dirOption = ['--dir [dir]', 'Target directory', { default: process.cwd() }] as const;

  cli
    .command('init', 'Initialize opsx-dev-pipeline templates in the current directory')
    .option('--tool <tool>', 'Target AI tool id')
    .option('--stack <frontend|backend|fullstack>', 'Target project stack')
    .option('--tech-stack <tech-stack>', 'Target tech stack (e.g. java-spring-boot, react-vite)')
    .option('--lang <en|zh>', 'Document language for AI-generated artifacts (default: zh)')
    .option(
      '--yes',
      'Auto-confirm all prompts (non-interactive mode); does NOT force-overwrite files',
    )
    .option('--force', 'Overwrite existing managed files even if they would conflict')
    .option('--dry-run', 'Preview generated files without writing them')
    .option('--feature <feature>', 'Enable an optional feature (e.g. structural-analysis-hint)')
    .option('--scope <user|project>', 'Install scope: project-level (default) or user-level (~)')
    .option(...dirOption)
    .action(async (options) => {
      await runInitCommand({ ...options, language: options.lang });
    });

  cli
    .command('sync', 'Re-render managed files from opsx-dev-pipeline manifest')
    .option(
      '--yes',
      'Auto-confirm all prompts (non-interactive mode); does NOT force-overwrite files',
    )
    .option('--force', 'Overwrite existing managed files even if they would conflict')
    .option('--dry-run', 'Preview synchronized files without writing them')
    .option('--lang <en|zh>', 'Document language for AI-generated artifacts')
    .option(...dirOption)
    .action(async (options) => {
      await runSyncCommand({ ...options, language: options.lang });
    });

  cli
    .command(
      'upgrade',
      'Upgrade managed files using the current opsx-dev-pipeline package templates',
    )
    .option(
      '--yes',
      'Auto-confirm all prompts (non-interactive mode); does NOT force-overwrite files',
    )
    .option('--force', 'Overwrite existing managed files even if they would conflict')
    .option('--dry-run', 'Preview upgraded files without writing them')
    .option('--lang <en|zh>', 'Document language for AI-generated artifacts')
    .option(...dirOption)
    .action(async (options) => {
      await runUpgradeCommand({ ...options, language: options.lang });
    });

  cli
    .command('uninstall', 'Remove managed files tracked by opsx-dev-pipeline manifest')
    .option('--yes', 'Remove all matched managed files without prompts')
    .option('--dry-run', 'Preview files that would be removed without deleting them')
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
    .command('doctor', 'Inspect current directory for opsx-dev-pipeline metadata')
    .option('--json', 'Print doctor report as JSON')
    .option('--stack', 'Only validate the stack profile in openspec/config.yaml')
    .option(...dirOption)
    .action(async (options) => {
      const status = await runDoctorCommand(options.dir, Boolean(options.json), {
        stackOnly: Boolean(options.stack),
      });

      if (status === 'fail') {
        process.exitCode = 1;
      }
    });

  cli
    .command('config effective', 'Show the synthesized effective configuration')
    .option('--format <yaml|json>', 'Output format', { default: 'yaml' })
    .option('--explain', 'Show configuration source explanation')
    .option(...dirOption)
    .action(async (options) => {
      await runConfigEffectiveCommand({
        dir: options.dir,
        format: options.format,
        explain: Boolean(options.explain),
      });
    });

  cli
    .command('knowledge select', 'Select knowledge references for a phase')
    .option('--phase <phase>', 'Phase number (required)')
    .option('--routes <routes>', 'Comma-separated route types (e.g. trivial,standard,full)')
    .option('--paths <paths>', 'Comma-separated file paths for path_hints matching')
    .option('--format <yaml|json>', 'Output format', { default: 'yaml' })
    .action(async (options) => {
      if (options.phase === undefined) {
        console.error('Error: --phase is required');
        process.exit(1);
      }

      await runKnowledgeSelectCommand({
        phase: Number(options.phase),
        routes: options.routes ? options.routes.split(',').map((s: string) => s.trim()) : undefined,
        paths: options.paths ? options.paths.split(',').map((s: string) => s.trim()) : undefined,
        format: options.format,
      });
    });

  cli.help();
  cli.version(PACKAGE_VERSION);
  cli.parse(argv, { run: false });
  await cli.runMatchedCommand();
}
