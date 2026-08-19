import type { StackId } from '../adapters/types.js';

export type TechStackId = 'java-spring-boot' | 'react-vite' | 'java-react' | 'python-fastapi';

export interface TechStackDefinition {
  id: TechStackId;
  displayName: string;
  description: string;
  parentStack: StackId;
}
