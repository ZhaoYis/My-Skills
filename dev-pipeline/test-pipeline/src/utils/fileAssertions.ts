import path from 'node:path';
import { fileExists, readFile } from './tempDir.js';

export interface FileAssertion {
  description: string;
  passed: boolean;
  detail?: string;
}

/**
 * Assert that a file exists at the given path.
 */
export async function expectFileExists(filePath: string): Promise<FileAssertion> {
  const exists = await fileExists(filePath);
  return {
    description: `File exists: ${filePath}`,
    passed: exists,
    detail: exists ? undefined : `Expected file not found: ${filePath}`,
  };
}

/**
 * Assert that a directory exists at the given path.
 */
export async function expectDirExists(dirPath: string): Promise<FileAssertion> {
  try {
    const { stat } = await import('node:fs/promises');
    const s = await stat(dirPath);
    const isDir = s.isDirectory();
    return {
      description: `Directory exists: ${dirPath}`,
      passed: isDir,
      detail: isDir ? undefined : `Expected directory but found file: ${dirPath}`,
    };
  } catch {
    return {
      description: `Directory exists: ${dirPath}`,
      passed: false,
      detail: `Directory not found: ${dirPath}`,
    };
  }
}

/**
 * Assert that a file contains the given text or pattern.
 */
export async function expectFileContains(
  filePath: string,
  pattern: string | RegExp,
  description?: string,
): Promise<FileAssertion> {
  const desc = description || `File contains pattern: ${String(pattern)}`;
  try {
    const content = await readFile(filePath);
    const passed = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
    return {
      description: desc,
      passed,
      detail: passed ? undefined : `Pattern "${String(pattern)}" not found in ${filePath}`,
    };
  } catch (e) {
    return {
      description: desc,
      passed: false,
      detail: `Cannot read file ${filePath}: ${String(e)}`,
    };
  }
}

/**
 * Assert that files matching a glob pattern exist under a directory.
 * Returns assertions for each expected file.
 */
export async function expectFilesExist(
  baseDir: string,
  expectedFiles: string[],
): Promise<FileAssertion[]> {
  return Promise.all(
    expectedFiles.map(async (f) => {
      const fullPath = path.join(baseDir, f);
      return expectFileExists(fullPath);
    }),
  );
}

/**
 * Assert that a directory contains at least the expected set of files.
 */
export async function expectDirContains(
  dirPath: string,
  expectedRelativePaths: string[],
): Promise<FileAssertion[]> {
  return expectFilesExist(dirPath, expectedRelativePaths);
}

/**
 * Assert that a JSON file parses successfully and optionally matches a schema.
 */
export async function expectValidJson(filePath: string): Promise<FileAssertion> {
  try {
    const content = await readFile(filePath);
    JSON.parse(content);
    return {
      description: `Valid JSON: ${filePath}`,
      passed: true,
    };
  } catch (e) {
    return {
      description: `Valid JSON: ${filePath}`,
      passed: false,
      detail: `Invalid JSON: ${String(e)}`,
    };
  }
}

/**
 * Assert that a file path matches conventional commit format.
 */
export async function expectConventionalCommit(message: string): Promise<FileAssertion> {
  // Conventional commit: type(scope?): description
  const conventionalPattern =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+/;
  return {
    description: 'Commit message follows conventional commit format',
    passed: conventionalPattern.test(message),
    detail: conventionalPattern.test(message)
      ? undefined
      : `Commit message "${message}" does not follow conventional commit format`,
  };
}

/**
 * Batch all assertions and return a summary.
 */
export interface AssertionSummary {
  all: FileAssertion[];
  passed: FileAssertion[];
  failed: FileAssertion[];
  passRate: number;
}

export function summarizeAssertions(assertions: FileAssertion[]): AssertionSummary {
  const passed = assertions.filter((a) => a.passed);
  const failed = assertions.filter((a) => !a.passed);
  return {
    all: assertions,
    passed,
    failed,
    passRate: assertions.length > 0 ? passed.length / assertions.length : 1,
  };
}
