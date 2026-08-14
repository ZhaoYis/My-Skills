import path from 'node:path';

/**
 * Input sanitization utilities to prevent template injection and other attacks.
 */

/**
 * Sanitize a project name to prevent Handlebars template injection (SSTI).
 *
 * Strips characters that have special meaning in Handlebars templates:
 *   - {{ }} (expression delimiters)
 *   - {{{ }}} (raw/unescaped delimiters)
 *   - { } (partial / helper syntax)
 *
 * Also trims whitespace and collapses consecutive spaces.
 */
export function sanitizeProjectName(raw: string): string {
  // Remove all curly braces (Handlebars syntax characters)
  let sanitized = raw.replace(/[{}]/g, '');
  // Remove backslashes (could be used to escape into template syntax)
  sanitized = sanitized.replace(/\\/g, '');
  // Collapse consecutive whitespace into a single space
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized;
}

/**
 * Validate that a resolved file path stays within the expected base directory.
 * Prevents path traversal attacks via crafted relative paths (e.g. "../../etc/passwd").
 *
 * @returns The validated absolute path.
 * @throws Error if the resolved path escapes the base directory.
 */
export function assertPathWithinBase(baseDir: string, relativePath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, relativePath);

  // Ensure the resolved target is either the base dir itself or a descendant
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error(
      `Path traversal detected: "${relativePath}" resolves outside the target directory`,
    );
  }

  return resolvedTarget;
}
