import type { StackId } from '../adapters/types.js';
import type { ProgrammingLanguageDefinition, ProgrammingLanguageId } from './types.js';

export const PROGRAMMING_LANGUAGE_REGISTRY: Record<
  ProgrammingLanguageId,
  ProgrammingLanguageDefinition
> = {
  java: { id: 'java', role: 'backend' },
  python: { id: 'python', role: 'backend' },
  typescript: { id: 'typescript', role: 'frontend' },
};

export const DEFAULT_STACK_LANGUAGES: Record<StackId, ProgrammingLanguageId[]> = {
  backend: ['java'],
  frontend: ['typescript'],
  fullstack: ['java', 'typescript'],
};

export const RULE_CATEGORY_ORDER = ['proposal', 'api-design', 'specs', 'design'] as const;
