import type { InitOptions } from '../../core/prompts/types.js';
import { runSyncCommand } from './sync.js';

export async function runUpgradeCommand(options: InitOptions): Promise<void> {
  await runSyncCommand(options);
}
