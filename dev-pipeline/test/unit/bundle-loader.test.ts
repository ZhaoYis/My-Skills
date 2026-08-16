import { describe, expect, it } from 'vitest';
import {
  isPhaseAllowed,
  getRoutePhasePath,
  formatPhaseBundleMarkdown,
  formatPhaseBundleJson,
} from '../../src/core/bundle/loader.js';
import type { PhaseBundle } from '../../src/core/bundle/types.js';

describe('bundle loader', () => {
  describe('isPhaseAllowed', () => {
    it('allows all phases for standard route', () => {
      for (let phase = 0; phase <= 7; phase++) {
        expect(isPhaseAllowed('standard', phase)).toBe(true);
      }
    });

    it('allows all phases for full route', () => {
      for (let phase = 0; phase <= 7; phase++) {
        expect(isPhaseAllowed('full', phase)).toBe(true);
      }
    });

    it('allows only 0, 2, 6 for trivial route', () => {
      expect(isPhaseAllowed('trivial', 0)).toBe(true);
      expect(isPhaseAllowed('trivial', 1)).toBe(false);
      expect(isPhaseAllowed('trivial', 2)).toBe(true);
      expect(isPhaseAllowed('trivial', 3)).toBe(false);
      expect(isPhaseAllowed('trivial', 4)).toBe(false);
      expect(isPhaseAllowed('trivial', 5)).toBe(false);
      expect(isPhaseAllowed('trivial', 6)).toBe(true);
      expect(isPhaseAllowed('trivial', 7)).toBe(false);
    });

    it('defaults to standard for unknown route', () => {
      expect(isPhaseAllowed('unknown', 1)).toBe(true);
      expect(isPhaseAllowed('unknown', 3)).toBe(true);
    });
  });

  describe('getRoutePhasePath', () => {
    it('returns correct path for trivial route', () => {
      expect(getRoutePhasePath('trivial')).toEqual([0, 2, 6]);
    });

    it('returns correct path for standard route', () => {
      expect(getRoutePhasePath('standard')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns correct path for full route', () => {
      expect(getRoutePhasePath('full')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('defaults to standard for unknown route', () => {
      expect(getRoutePhasePath('unknown')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('formatPhaseBundleMarkdown', () => {
    it('formats normal bundle correctly', () => {
      const bundle: PhaseBundle = {
        phase: 2,
        title: '提案应用 (Apply)',
        reference: '# Phase 2\n\n执行指引内容...',
        knowledge: [
          {
            file: '/path/to/ref.md',
            phase: 2,
            asset_kind: 'procedure',
            description: '应用阶段指引',
          },
        ],
        route: 'standard',
        skipped: false,
      };

      const result = formatPhaseBundleMarkdown(bundle);

      expect(result).toContain('# Phase 2: 提案应用 (Apply)');
      expect(result).toContain('**Route**: standard');
      expect(result).toContain('## 相关知识');
      expect(result).toContain('**procedure**: 应用阶段指引');
      expect(result).toContain('## 执行指引');
      expect(result).toContain('执行指引内容...');
    });

    it('formats skipped bundle correctly', () => {
      const bundle: PhaseBundle = {
        phase: 1,
        title: '提案编写 (Propose)',
        reference: '',
        knowledge: [],
        route: 'trivial',
        skipped: true,
        skipReason: 'Route "trivial" 跳过此 Phase。当前 Route 路径：0 → 2 → 6',
      };

      const result = formatPhaseBundleMarkdown(bundle);

      expect(result).toContain('# Phase 1: 提案编写 (Propose)');
      expect(result).toContain('**Route**: trivial');
      expect(result).toContain('⚠️ **此 Phase 已被当前 Route 跳过**');
      expect(result).toContain('Route "trivial" 跳过此 Phase');
      expect(result).not.toContain('## 执行指引');
    });

    it('formats bundle without knowledge', () => {
      const bundle: PhaseBundle = {
        phase: 0,
        title: '入口判断 + Route 分级',
        reference: '# Phase 0\n\n入口指引...',
        knowledge: [],
        route: 'standard',
        skipped: false,
      };

      const result = formatPhaseBundleMarkdown(bundle);

      expect(result).toContain('# Phase 0: 入口判断 + Route 分级');
      expect(result).not.toContain('## 相关知识');
      expect(result).toContain('## 执行指引');
    });
  });

  describe('formatPhaseBundleJson', () => {
    it('formats bundle as valid JSON', () => {
      const bundle: PhaseBundle = {
        phase: 3,
        title: '代码审查 (Review)',
        reference: '# Phase 3\n\n审查指引...',
        knowledge: [
          {
            file: '/path/to/ref.md',
            phase: 3,
            asset_kind: 'constraint',
            description: '审查规范',
          },
        ],
        route: 'full',
        skipped: false,
      };

      const result = formatPhaseBundleJson(bundle);
      const parsed = JSON.parse(result);

      expect(parsed.phase).toBe(3);
      expect(parsed.title).toBe('代码审查 (Review)');
      expect(parsed.route).toBe('full');
      expect(parsed.skipped).toBe(false);
      expect(parsed.knowledge).toHaveLength(1);
      expect(parsed.knowledge[0].asset_kind).toBe('constraint');
    });
  });
});
