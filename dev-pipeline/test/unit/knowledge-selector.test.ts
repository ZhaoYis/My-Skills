import { describe, expect, it } from 'vitest';
import {
  selectKnowledge,
  formatKnowledgeSelectResult,
} from '../../src/core/knowledge/selector.js';
import type { KnowledgeMetadata } from '../../src/core/knowledge/types.js';

describe('knowledge selector', () => {
  const mockMetadata: KnowledgeMetadata[] = [
    {
      file: '/refs/phase-0-entrance.md',
      phase: 0,
      asset_kind: 'procedure',
      routes: ['trivial', 'standard', 'full'],
      path_hints: ['openspec/changes/**'],
      description: '入口判断',
    },
    {
      file: '/refs/phase-1-propose.md',
      phase: 1,
      asset_kind: 'procedure',
      routes: ['standard', 'full'],
      path_hints: ['openspec/changes/**/proposal.md'],
      description: '提案编写',
    },
    {
      file: '/refs/phase-2-apply.md',
      phase: 2,
      asset_kind: 'procedure',
      routes: ['trivial', 'standard', 'full'],
      path_hints: ['src/**', 'tests/**'],
      description: '提案应用',
    },
    {
      file: '/refs/phase-3-review.md',
      phase: 3,
      asset_kind: 'constraint',
      routes: ['standard', 'full'],
      path_hints: ['src/**'],
      description: '代码审查',
    },
  ];

  describe('selectKnowledge', () => {
    it('selects by phase', () => {
      const result = selectKnowledge(mockMetadata, { phase: 2 });
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].file).toBe('/refs/phase-2-apply.md');
    });

    it('filters by route', () => {
      const result = selectKnowledge(mockMetadata, { phase: 1, routes: ['trivial'] });
      expect(result.selected).toHaveLength(0);
      expect(result.skipped.some((s) => s.file === '/refs/phase-1-propose.md')).toBe(true);
    });

    it('includes phase when route matches', () => {
      const result = selectKnowledge(mockMetadata, { phase: 1, routes: ['standard'] });
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].file).toBe('/refs/phase-1-propose.md');
    });

    it('selects all phases for standard route', () => {
      const result = selectKnowledge(mockMetadata, { phase: 0, routes: ['trivial'] });
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].file).toBe('/refs/phase-0-entrance.md');
    });

    it('filters by path hints', () => {
      const result = selectKnowledge(mockMetadata, {
        phase: 2,
        paths: ['src/main/java/User.java'],
      });
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].file).toBe('/refs/phase-2-apply.md');
    });

    it('skips when path hints do not match', () => {
      const result = selectKnowledge(mockMetadata, {
        phase: 1,
        routes: ['standard'],
        paths: ['docs/readme.md'],
      });
      expect(result.selected).toHaveLength(0);
    });

    it('sorts by asset_kind rank', () => {
      const metadataWithConstraint: KnowledgeMetadata[] = [
        {
          file: '/refs/procedure.md',
          phase: 3,
          asset_kind: 'procedure',
          routes: ['standard'],
          path_hints: [],
          description: 'Procedure',
        },
        {
          file: '/refs/constraint.md',
          phase: 3,
          asset_kind: 'constraint',
          routes: ['standard'],
          path_hints: [],
          description: 'Constraint',
        },
      ];
      const result = selectKnowledge(metadataWithConstraint, { phase: 3 });
      expect(result.selected[0].asset_kind).toBe('constraint');
      expect(result.selected[1].asset_kind).toBe('procedure');
    });

    it('returns empty selected when no match', () => {
      const result = selectKnowledge(mockMetadata, { phase: 99 });
      expect(result.selected).toHaveLength(0);
      expect(result.skipped).toHaveLength(4);
    });
  });

  describe('formatKnowledgeSelectResult', () => {
    it('formats selected and skipped items', () => {
      const result = selectKnowledge(mockMetadata, { phase: 2 });
      const formatted = formatKnowledgeSelectResult(result);

      expect(formatted).toContain('selected:');
      expect(formatted).toContain('/refs/phase-2-apply.md');
      expect(formatted).toContain('phase: 2');
      expect(formatted).toContain('asset_kind: procedure');
      expect(formatted).toContain('skipped:');
    });

    it('formats empty result', () => {
      const result = selectKnowledge(mockMetadata, { phase: 99 });
      const formatted = formatKnowledgeSelectResult(result);

      expect(formatted).toContain('selected:');
      expect(formatted).toContain('[]');
      expect(formatted).toContain('skipped:');
    });
  });
});
