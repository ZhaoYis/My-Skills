import path from 'node:path';
import { cac } from 'cac';
import { McpToolServer } from '../agent/host/mcp-tool-server.js';
import { StdioToolServer } from '../agent/host/stdio-tool-server.js';
import { JsonFileStateStore } from '../agent/runtime/state-store.js';
import { createLocalToolRegistry } from '../agent/tools/registry.js';
import { PACKAGE_VERSION } from '../core/runtime/meta.js';
import { runAgentCommand } from './commands/agent.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runInitCommand } from './commands/init.js';
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
    .command('agent-status <change>', 'Show the persisted Agent pipeline state')
    .option('--json', 'Print state as JSON')
    .option(...dirOption)
    .action(async (change, options) => {
      await runAgentCommand('status', change, options);
    });

  cli
    .command('agent-approve <change>', 'Approve a pending Agent action')
    .option('--action-id <action-id>', 'Pending action id')
    .option('--json', 'Print state as JSON')
    .option(...dirOption)
    .action(async (change, options) => {
      await runAgentCommand('approve', change, options);
    });

  cli
    .command('agent-pause <change>', 'Pause an Agent pipeline run')
    .option('--reason <reason>', 'Pause reason')
    .option('--json', 'Print state as JSON')
    .option(...dirOption)
    .action(async (change, options) => {
      await runAgentCommand('pause', change, options);
    });

  cli
    .command('agent-resume <change>', 'Resume a paused Agent pipeline run')
    .option('--json', 'Print state as JSON')
    .option(...dirOption)
    .action(async (change, options) => {
      await runAgentCommand('resume', change, options);
    });

  cli
    .command('agent-transition <change>', 'Move an Agent pipeline run through a validated gate')
    .option('--phase <phase>', 'Target phase')
    .option('--step <step>', 'Target step')
    .option('--json', 'Print state as JSON')
    .option(...dirOption)
    .action(async (change, options) => {
      await runAgentCommand('transition', change, options);
    });

  cli
    .command('agent-run <change>', 'Run safe Agent actions until the next checkpoint')
    .option('--max-steps <steps>', 'Maximum number of actions to execute (default: 10)')
    .option('--planner <deterministic|model>', 'Planner implementation (default: deterministic)')
    .option('--endpoint <url>', 'OpenAI-compatible model endpoint (model planner only)')
    .option('--model <model>', 'Model name (model planner only)')
    .option('--timeout-ms <ms>', 'Model request timeout in milliseconds')
    .option('--max-retries <count>', 'Maximum model request retries')
    .option('--json', 'Print the final Runtime result as JSON')
    .option(...dirOption)
    .action(async (change, options) => {
      await runAgentCommand('run', change, options);
    });

  cli
    .command('agent-stdio', 'Serve Agent tools through the standard MCP protocol over stdio')
    .option(...dirOption)
    .action(async (options) => {
      const rootDir = path.resolve(options.dir ?? process.cwd());
      await new McpToolServer(
        createLocalToolRegistry(rootDir),
        new JsonFileStateStore(rootDir),
      ).serve();
    });

  cli
    .command('agent-jsonrpc', 'Serve the legacy newline-delimited Agent protocol over stdio')
    .option(...dirOption)
    .action(async (options) => {
      const rootDir = path.resolve(options.dir ?? process.cwd());
      await new StdioToolServer(
        createLocalToolRegistry(rootDir),
        new JsonFileStateStore(rootDir),
      ).serve();
    });

  cli.help();
  cli.version(PACKAGE_VERSION);
  cli.parse(argv, { run: false });
  await cli.runMatchedCommand();
}
