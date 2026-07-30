import { rm } from 'node:fs/promises';

export async function cleanupDirectories(directories: string[]): Promise<void> {
  for (const directory of directories.splice(0)) {
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}
