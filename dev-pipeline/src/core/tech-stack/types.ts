import type { StackId } from '../adapters/types.js';

export type TechStackId =
  | 'java-spring-boot'
  | 'react-vite'
  | 'java-react'
  | 'python-fastapi'
  | 'python-react';

export interface TechStackDefinition {
  id: TechStackId;
  displayName: string;
  description: string;
  parentStack: StackId;
}
