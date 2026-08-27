export type ProgrammingLanguageId = 'java' | 'python' | 'typescript';

export interface ProgrammingLanguageDefinition {
  id: ProgrammingLanguageId;
  role: 'backend' | 'frontend';
}
