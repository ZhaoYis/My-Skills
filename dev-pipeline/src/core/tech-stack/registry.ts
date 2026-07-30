import type { StackId } from '../adapters/types.js';
import type { TechStackDefinition, TechStackId } from './types.js';

export const TECH_STACK_REGISTRY: TechStackDefinition[] = [
  {
    id: 'java-spring-boot',
    displayName: 'Java Spring Boot',
    description: 'Java 17+, Spring Boot 3.x, Maven/Gradle, MyBatis-Plus/JPA/JOOQ',
    parentStack: 'backend',
  },
  {
    id: 'react-vite',
    displayName: 'React + Vite',
    description: 'React 18+, TypeScript, Vite, Vitest + React Testing Library',
    parentStack: 'frontend',
  },
  {
    id: 'java-react',
    displayName: 'Java Spring Boot + React',
    description: 'Monorepo: React 18+ frontend + Java Spring Boot backend',
    parentStack: 'fullstack',
  },
];

export function getTechStacksByParentStack(parentStack: StackId): TechStackDefinition[] {
  return TECH_STACK_REGISTRY.filter((techStack) => techStack.parentStack === parentStack);
}

export function getTechStackById(id: string): TechStackDefinition | undefined {
  return TECH_STACK_REGISTRY.find((techStack) => techStack.id === id);
}

export function resolveTechStackId(value: string): TechStackId {
  const definition = getTechStackById(value);
  if (!definition) {
    throw new Error(
      `Invalid tech stack: ${value}. Valid: ${TECH_STACK_REGISTRY.map((techStack) => techStack.id).join(', ')}.`,
    );
  }

  return definition.id;
}
