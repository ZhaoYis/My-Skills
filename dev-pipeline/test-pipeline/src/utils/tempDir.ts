import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Temporary directory manager for test isolation.
 * Each test file gets its own temp directory, cleaned up after the test.
 */
const createdDirs: string[] = [];

/**
 * Create a unique temporary directory.
 */
export async function createTempDir(prefix: string = 'opsx-test-'): Promise<string> {
  const dir = path.resolve(os.tmpdir(), `${prefix}${randomSuffix()}`);
  await fs.promises.mkdir(dir, { recursive: true });
  createdDirs.push(dir);
  return dir;
}

/**
 * Clean up all temporary directories created in this test run.
 */
export async function cleanupAllTempDirs(): Promise<void> {
  const dirs = createdDirs.splice(0);
  for (const dir of dirs) {
    await fs.promises.rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}

/**
 * Copy a directory recursively.
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Check if a directory exists.
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Read a file as text.
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

/**
 * Write content to a file, creating parent directories as needed.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * List all files in a directory recursively.
 */
export async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(fullPath);
      result.push(...nested);
    } else {
      result.push(fullPath);
    }
  }

  return result;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
