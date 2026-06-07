#!/usr/bin/env node
import { runCli } from '../cli/index.js';

const argv = process.argv.slice(0, 2).concat('init', ...process.argv.slice(2));
await runCli(argv);
