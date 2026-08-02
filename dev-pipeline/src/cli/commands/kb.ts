import { spawn } from 'node:child_process';
import path from 'node:path';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';

export async function runKbCommand(args: string[]): Promise<void> {
  const packageRoot = await resolvePackageRoot(import.meta.url);
  const script = path.join(packageRoot, 'templates/common/knowledge/scripts/kb.mjs');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Knowledge command terminated by ${signal}.`));
      } else if (code !== 0) {
        reject(new Error(`Knowledge command failed with exit code ${code ?? 1}.`));
      } else {
        resolve();
      }
    });
  });
}
