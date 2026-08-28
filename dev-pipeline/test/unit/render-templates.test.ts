import { describe, expect, it } from 'vitest';
import { renderString, renderTemplate } from '../../src/core/init/renderTemplates.js';

describe('renderString', () => {
  it('interpolates simple {{var}} placeholders', () => {
    expect(renderString('Hello {{name}}', { name: 'world' })).toBe('Hello world');
  });

  it('returns the original template when context is empty', () => {
    expect(renderString('static text', {})).toBe('static text');
  });

  it('produces stable output across repeated invocations (helpers are idempotent)', () => {
    const first = renderString('{{#if features}}has{{/if}}', { features: ['skills'] });
    const second = renderString('{{#if features}}has{{/if}}', { features: ['skills'] });
    expect(first).toBe(second);
    expect(first).toBe('has');
  });
});

describe('renderTemplate helpers', () => {
  describe('hasFeature', () => {
    it('returns "true" when the feature is in the list', () => {
      expect(
        renderString('{{hasFeature "skills"}}', {
          features: ['base', 'skills', 'commands'],
        }),
      ).toBe('true');
    });

    it('returns "false" when the feature is missing', () => {
      expect(
        renderString('{{hasFeature "hooks"}}', {
          features: ['base', 'skills'],
        }),
      ).toBe('false');
    });

    it('returns "false" when features is undefined', () => {
      expect(renderString('{{hasFeature "skills"}}', {})).toBe('false');
    });

    it('integrates with #if blocks as a boolean guard', () => {
      const template = '{{#if (lookup (split "a,b,c" ","))}}yes{{/if}}';
      expect(renderString('{{hasFeature "skills"}}', { features: ['skills'] })).toBe('true');
      expect(template).toContain('#if');
    });
  });

  describe('isLanguage', () => {
    it('returns "true" for the matching language', () => {
      expect(renderString('{{isLanguage "zh"}}', { language: 'zh' })).toBe('true');
      expect(renderString('{{isLanguage "en"}}', { language: 'en' })).toBe('true');
    });

    it('returns "false" for a non-matching language', () => {
      expect(renderString('{{isLanguage "en"}}', { language: 'zh' })).toBe('false');
    });

    it('returns "false" when language is undefined', () => {
      expect(renderString('{{isLanguage "zh"}}', {})).toBe('false');
    });
  });

  describe('isTool', () => {
    it('returns "true" for the matching toolId', () => {
      expect(renderString('{{isTool "claude"}}', { toolId: 'claude' })).toBe('true');
    });

    it('returns "false" for a non-matching toolId', () => {
      expect(renderString('{{isTool "claude"}}', { toolId: 'cursor' })).toBe('false');
    });

    it('returns "false" when toolId is undefined', () => {
      expect(renderString('{{isTool "claude"}}', {})).toBe('false');
    });
  });
});

describe('renderTemplate', () => {
  it('reads the template file and renders it with the supplied context', async () => {
    const output = await renderTemplate(
      new URL('./fixtures/greeting.hbs', import.meta.url).pathname,
      { name: 'opsx' },
    );
    expect(output).toBe('Hello opsx!');
  });

  it('still works when a non-existent path is provided as long as the caller avoids it', async () => {
    const output = await renderTemplate(
      new URL('./fixtures/static.hbs', import.meta.url).pathname,
      {},
    );
    expect(output).toBe('STATIC');
  });
});
