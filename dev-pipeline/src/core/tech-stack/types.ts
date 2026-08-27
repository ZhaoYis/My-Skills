import type { StackId } from '../adapters/types.js';
import type { ProgrammingLanguageId } from '../config/types.js';

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
  programmingLanguages: ProgrammingLanguageId[];
}
