import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STACK_LANGUAGES,
  PROGRAMMING_LANGUAGE_REGISTRY,
  RULE_CATEGORY_ORDER,
} from '../../src/core/config/programmingLanguages.js';

describe('PROGRAMMING_LANGUAGE_REGISTRY', () => {
  it('registers java, python, and typescript with the expected roles', () => {
    expect(Object.keys(PROGRAMMING_LANGUAGE_REGISTRY).sort()).toEqual([
      'java',
      'python',
      'typescript',
    ]);
    expect(PROGRAMMING_LANGUAGE_REGISTRY.java).toEqual({ id: 'java', role: 'backend' });
    expect(PROGRAMMING_LANGUAGE_REGISTRY.python).toEqual({ id: 'python', role: 'backend' });
    expect(PROGRAMMING_LANGUAGE_REGISTRY.typescript).toEqual({
      id: 'typescript',
      role: 'frontend',
    });
  });

  it('keeps every entry aligned with the registered id', () => {
    for (const [id, definition] of Object.entries(PROGRAMMING_LANGUAGE_REGISTRY)) {
      expect(definition.id).toBe(id);
      expect(['backend', 'frontend']).toContain(definition.role);
    }
  });
});

describe('DEFAULT_STACK_LANGUAGES', () => {
  it('maps every stack id to a non-empty language list', () => {
    expect(Object.keys(DEFAULT_STACK_LANGUAGES).sort()).toEqual([
      'backend',
      'frontend',
      'fullstack',
    ]);
    for (const languages of Object.values(DEFAULT_STACK_LANGUAGES)) {
      expect(languages.length).toBeGreaterThan(0);
      for (const language of languages) {
        expect(Object.keys(PROGRAMMING_LANGUAGE_REGISTRY)).toContain(language);
      }
    }
  });

  it('returns the canonical defaults for each stack', () => {
    expect(DEFAULT_STACK_LANGUAGES.backend).toEqual(['java']);
    expect(DEFAULT_STACK_LANGUAGES.frontend).toEqual(['typescript']);
    expect(DEFAULT_STACK_LANGUAGES.fullstack).toEqual(['java', 'typescript']);
  });
});

describe('RULE_CATEGORY_ORDER', () => {
  it('lists the canonical rule category order', () => {
    expect(RULE_CATEGORY_ORDER).toEqual(['proposal', 'api-design', 'specs', 'design']);
  });

  it('contains no duplicates', () => {
    const unique = new Set(RULE_CATEGORY_ORDER);
    expect(unique.size).toBe(RULE_CATEGORY_ORDER.length);
  });
});
