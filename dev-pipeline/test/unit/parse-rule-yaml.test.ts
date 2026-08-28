import { describe, expect, it } from 'vitest';
import {
  formatRuleGroups,
  mergeRuleGroups,
  parseRuleYaml,
} from '../../src/core/config/parseRuleYaml.js';

describe('parseRuleYaml', () => {
  it('returns an empty object for an empty string', () => {
    expect(parseRuleYaml('')).toEqual({});
  });

  it('ignures comment-only lines', () => {
    expect(parseRuleYaml('# just a comment\n# another\n')).toEqual({});
  });

  it('parses simple rules into category arrays', () => {
    const groups = parseRuleYaml(`
proposal:
  - First rule
  - Second rule
specs:
  - Third rule
`);
    expect(groups).toEqual({
      proposal: ['First rule', 'Second rule'],
      specs: ['Third rule'],
    });
  });

  it('strips both single and double quotes from values', () => {
    const groups = parseRuleYaml(`
proposal:
  - "Quoted rule"
  - 'Single quoted rule'
  - Plain rule
`);
    expect(groups.proposal).toEqual(['Quoted rule', 'Single quoted rule', 'Plain rule']);
  });

  it('handles dashes without a following space as items', () => {
    const groups = parseRuleYaml(`
proposal:
  -no-space
  - with-space
`);
    expect(groups.proposal).toEqual(['with-space']);
  });

  it('keeps multiple declarations of the same category', () => {
    const groups = parseRuleYaml(`
proposal:
  - First
specs:
  - Specs rule
proposal:
  - Second
`);
    expect(groups.proposal).toEqual(['First', 'Second']);
  });

  it('ignores unknown indented lines without an active category', () => {
    const groups = parseRuleYaml(`
  - orphan item
`);
    expect(groups).toEqual({});
  });
});

describe('mergeRuleGroups', () => {
  it('merges two packs without duplicates', () => {
    const merged = mergeRuleGroups([
      { proposal: ['A', 'B'], specs: ['X'] },
      { proposal: ['B', 'C'], design: ['Y'] },
    ]);
    expect(merged).toEqual({
      proposal: ['A', 'B', 'C'],
      specs: ['X'],
      design: ['Y'],
    });
  });

  it('returns an empty object for empty input', () => {
    expect(mergeRuleGroups([])).toEqual({});
  });

  it('preserves the original rule order on first appearance', () => {
    const merged = mergeRuleGroups([{ proposal: ['A', 'B'] }, { proposal: ['A', 'B', 'C'] }]);
    expect(merged.proposal).toEqual(['A', 'B', 'C']);
  });
});

describe('formatRuleGroups', () => {
  it('formats rule groups using categoryOrder and skips empty categories', () => {
    const formatted = formatRuleGroups(
      {
        proposal: ['A'],
        specs: ['B'],
        apiDesign: ['C'],
      },
      ['proposal', 'api-design', 'specs', 'design'],
    );

    expect(formatted.indexOf('  proposal:')).toBeLessThan(formatted.indexOf('  specs:'));
    expect(formatted).not.toContain('  api-design:');
    expect(formatted).toContain('  apiDesign:');
    expect(formatted).not.toMatch(/^\s*-\s*"?"$/m);
  });

  it('appends categories not listed in categoryOrder after the ordered ones', () => {
    const formatted = formatRuleGroups(
      {
        proposal: ['A'],
        custom: ['B'],
        other: ['C'],
      },
      ['proposal'],
    );

    const proposalIdx = formatted.indexOf('  proposal:');
    const customIdx = formatted.indexOf('  custom:');
    const otherIdx = formatted.indexOf('  other:');
    expect(proposalIdx).toBeGreaterThanOrEqual(0);
    expect(customIdx).toBeGreaterThan(proposalIdx);
    expect(otherIdx).toBeGreaterThan(customIdx);
  });

  it('returns an empty string when every category is empty', () => {
    expect(formatRuleGroups({ proposal: [], specs: [] }, ['proposal', 'specs'])).toBe('');
  });

  it('JSON-stringifies rule values so quoting is preserved on roundtrip', () => {
    const formatted = formatRuleGroups({ proposal: ['Keep this rule'] }, ['proposal']);
    expect(formatted).toContain('- "Keep this rule"');
  });

  it('emits at least one rule block when only categoryOrder-aligned categories have items', () => {
    const formatted = formatRuleGroups({ design: ['A rule'] }, ['design']);
    expect(formatted).toContain('  design:');
    expect(formatted).toContain('- "A rule"');
  });
});
