import type { InitOptions } from '../../core/prompts/types.js';
import { runInit } from '../../core/init/runInit.js';

export async function runInitCommand(options: Record<string, unknown>): Promise<void> {
  if (options.yes && !options.stack) {
    throw new Error(
      'Missing required --stack in non-interactive mode. Use --stack frontend or --stack backend.',
    );
  }
  await runInit(options as InitOptions);
}
