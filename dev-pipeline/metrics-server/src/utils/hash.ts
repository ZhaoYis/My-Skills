import { createHash } from 'node:crypto';

export function contentHash(content: string): string {
  return createHash('md5').update(content, 'utf8').digest('hex');
}
