import { describe, expect, it } from 'vitest';
import {
  getTechStackById,
  getTechStacksByParentStack,
  resolveTechStackId,
  TECH_STACK_REGISTRY,
} from '../../src/core/tech-stack/registry.js';

describe('tech stack registry', () => {
  it('registers one initial tech stack for each parent stack', () => {
    expect(TECH_STACK_REGISTRY).toHaveLength(3);
    expect(getTechStacksByParentStack('backend').map(({ id }) => id)).toEqual(['java-spring-boot']);
    expect(getTechStacksByParentStack('frontend').map(({ id }) => id)).toEqual(['react-vite']);
    expect(getTechStacksByParentStack('fullstack').map(({ id }) => id)).toEqual(['java-react']);
  });

  it('finds and resolves registered tech stacks', () => {
    expect(getTechStackById('react-vite')?.displayName).toBe('React + Vite');
    expect(resolveTechStackId('java-react')).toBe('java-react');
  });

  it('rejects unknown tech stacks and lists valid ids', () => {
    expect(() => resolveTechStackId('invalid')).toThrow(
      'Invalid tech stack: invalid. Valid: java-spring-boot, react-vite, java-react.',
    );
  });
});
