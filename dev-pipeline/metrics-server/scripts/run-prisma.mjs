import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preparePrisma } from './prisma-config.mjs';

const args = process.argv.slice(2);
if (!args.length) throw new Error('Usage: node scripts/run-prisma.mjs <prisma arguments>');

const config = await preparePrisma();
const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
const child = spawn(process.execPath, [prismaCli, ...args, '--schema', config.schemaPath], {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  throw error;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
