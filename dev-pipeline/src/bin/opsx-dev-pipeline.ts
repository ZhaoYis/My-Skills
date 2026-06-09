#!/usr/bin/env node
import pc from 'picocolors';
import { runCli } from '../cli/index.js';

try {
  await runCli(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(message));
  process.exit(1);
}
