import { describe, expect, it } from 'vitest';
import { durationSeconds, parseStateDate } from '../src/utils/date.js';
import { contentHash } from '../src/utils/hash.js';

describe('collector utilities', () => {
  it('parses local state time into a stable UTC wall-clock value', () => {
    expect(parseStateDate('2026-07-28 09:10:11').toISOString()).toBe('2026-07-28T09:10:11.000Z');
    expect(durationSeconds('2026-07-28 09:00:00', '2026-07-28 09:10:00')).toBe(600);
  });

  it('hashes the complete raw JSON content', () => {
    expect(contentHash('{"state":3}')).toMatch(/^[a-f0-9]{32}$/);
    expect(contentHash('{"state":3}')).not.toBe(contentHash('{"state":4}'));
  });
});
