#!/usr/bin/env node

import { spawn } from 'node:child_process';

const CLI = process.platform === 'win32' ? 'opsx-dev-pipeline.cmd' : 'opsx-dev-pipeline';
const forwardedArgs = ['load', ...process.argv.slice(2)];

const child = spawn(CLI, forwardedArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
let spawnFailed = false;

child.once('error', (error) => {
  spawnFailed = true;
  if (error.code === 'ENOENT') {
    console.error(
      'Error: opsx-dev-pipeline CLI is unavailable. Install it or add it to PATH; load-phase.mjs is only a compatibility wrapper.',
    );
    process.exitCode = 127;
    return;
  }

  console.error(`Error: failed to run opsx-dev-pipeline CLI: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (spawnFailed) return;

  if (signal) {
    console.error(`Error: opsx-dev-pipeline CLI terminated by signal ${signal}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
