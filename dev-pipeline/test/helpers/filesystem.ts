import { stat } from 'node:fs/promises';

export async function isSameFileSystemEntry(first: string, second: string): Promise<boolean> {
  const [firstStats, secondStats] = await Promise.all([stat(first), stat(second)]);
  return firstStats.dev === secondStats.dev && firstStats.ino === secondStats.ino;
}
