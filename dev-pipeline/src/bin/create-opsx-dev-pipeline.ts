#!/usr/bin/env node
import pc from 'picocolors';
import { runCli } from '../cli/index.js';

const argv = process.argv.slice(0, 2).concat('init', ...process.argv.slice(2));

try {
  await runCli(argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(message));
  process.exit(1);
}
