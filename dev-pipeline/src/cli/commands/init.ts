import type { InitOptions } from '../../core/prompts/types.js';
import { runInit } from '../../core/init/runInit.js';

export async function runInitCommand(options: Record<string, unknown>): Promise<void> {
  await runInit(options as InitOptions);
}
