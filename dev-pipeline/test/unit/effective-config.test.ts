import { describe, expect, it } from 'vitest';
import {
  deepMerge,
  formatSourcesExplanation,
} from '../../src/core/config/effective.js';
import type { ConfigSource } from '../../src/core/config/types.js';

describe('effective config', () => {
  describe('deepMerge', () => {
    it('merges simple objects', () => {
      const a = { x: 1 };
      const b = { y: 2 };
      expect(deepMerge(a, b)).toEqual({ x: 1, y: 2 });
    });

    it('later values override earlier ones', () => {
      const a = { x: 1 };
      const b = { x: 2 };
      expect(deepMerge(a, b)).toEqual({ x: 2 });
    });

    it('deeply merges nested objects', () => {
      const a = { pipeline: { language: 'zh', review: { max_rounds: 3 } } };
      const b = { pipeline: { review: { max_rounds: 5 } } };
      expect(deepMerge(a, b)).toEqual({
        pipeline: { language: 'zh', review: { max_rounds: 5 } },
      });
    });

    it('handles arrays by replacement', () => {
      const a = { items: [1, 2, 3] };
      const b = { items: [4, 5] };
      expect(deepMerge(a, b)).toEqual({ items: [4, 5] });
    });

    it('handles null values', () => {
      const a = { x: 1 };
      const b = { x: null };
      expect(deepMerge(a, b)).toEqual({ x: null });
    });

    it('handles undefined values by skipping', () => {
      const a = { x: 1 };
      const b = { x: undefined };
      expect(deepMerge(a, b)).toEqual({ x: 1 });
    });

    it('merges multiple objects', () => {
      const a = { x: 1 };
      const b = { y: 2 };
      const c = { z: 3 };
      expect(deepMerge(a, b, c)).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('handles empty objects', () => {
      const a = { x: 1 };
      const b = {};
      expect(deepMerge(a, b)).toEqual({ x: 1 });
    });
  });

  describe('formatSourcesExplanation', () => {
    it('formats sources grouped by source type', () => {
      const sources = new Map<string, ConfigSource>();
      sources.set('pipeline.language', { source: 'defaults', path: 'config/defaults.yaml' });
      sources.set('pipeline.review.max_rounds', { source: 'project', path: 'openspec/config.yaml' });
      sources.set('pipeline.git.branch_prefix', { source: 'override', path: 'openspec/overrides.yaml' });

      const result = formatSourcesExplanation(sources);

      expect(result).toContain('配置来源说明：');
      expect(result).toContain('[defaults]');
      expect(result).toContain('[project]');
      expect(result).toContain('[override]');
      expect(result).toContain('pipeline.language <- config/defaults.yaml');
      expect(result).toContain('pipeline.review.max_rounds <- openspec/config.yaml');
      expect(result).toContain('pipeline.git.branch_prefix <- openspec/overrides.yaml');
    });

    it('handles empty sources map', () => {
      const sources = new Map<string, ConfigSource>();
      const result = formatSourcesExplanation(sources);
      expect(result).toContain('配置来源说明：');
    });
  });
});
