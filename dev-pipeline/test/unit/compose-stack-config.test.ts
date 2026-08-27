import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeStackConfig } from '../../src/core/config/composeStackConfig.js';
import {
  formatRuleGroups,
  mergeRuleGroups,
  parseRuleYaml,
} from '../../src/core/config/parseRuleYaml.js';
import { RULE_CATEGORY_ORDER } from '../../src/core/config/programmingLanguages.js';
import { buildTemplateContext } from '../../src/core/init/buildInstallPlan.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const CONFIG_ROOT = path.join(PACKAGE_ROOT, 'src/templates/common/config');

async function compose(params: {
  stack: 'backend' | 'frontend' | 'fullstack';
  techStack?: 'java-spring-boot' | 'python-fastapi' | 'react-vite' | 'java-react' | 'python-react';
  language?: 'zh' | 'en';
}): Promise<string> {
  const language = params.language ?? 'zh';
  return composeStackConfig({
    configRoot: CONFIG_ROOT,
    stack: params.stack,
    techStack: params.techStack,
    language,
    context: buildTemplateContext({
      projectName: 'demo',
      toolId: 'claude',
      toolName: 'Claude Code',
      stack: params.stack,
      language,
      features: ['schema'],
      skillsDir: '.claude/skills',
      commandsDir: '.claude/commands',
      techStack: params.techStack,
      techStackName: params.techStack,
    }),
  });
}

describe('parseRuleYaml', () => {
  it('parses and merges unique rules in category order', () => {
    const java = parseRuleYaml(`
proposal:
  - Must include API contract changes
  - Must specify database migration strategy (Flyway/Liquibase)
specs:
  - Use Given/When/Then format for API behavior scenarios
`);
    const typescript = parseRuleYaml(`
proposal:
  - Must include UI/UX impact analysis
specs:
  - Use Given/When/Then format for user interaction scenarios
`);

    const merged = formatRuleGroups(mergeRuleGroups([java, typescript]), RULE_CATEGORY_ORDER);
    expect(merged).toContain('proposal:');
    expect(merged).toContain('Must include API contract changes');
    expect(merged).toContain('Must include UI/UX impact analysis');
    expect(merged.indexOf('proposal:')).toBeLessThan(merged.indexOf('specs:'));
  });
});

describe('composeStackConfig', () => {
  it('assembles java backend rules without frontend fragments', async () => {
    const config = await compose({ stack: 'backend', techStack: 'java-spring-boot' });

    expect(config).toContain('schema: backend');
    expect(config).toContain('Tech Stack: Java 17+, Spring Boot 3.x, Maven/Gradle');
    expect(config).toContain('Javadoc');
    expect(config).toContain('Flyway/Liquibase');
    expect(config).toContain('authentication and authorization');
    expect(config).toContain('Given/When/Then format for API behavior scenarios');
    expect(config).not.toContain('JSDoc');
    expect(config).not.toContain('hammer');
    expect(config).not.toContain('\nstack:');
  });

  it('assembles python backend rules instead of java', async () => {
    const config = await compose({ stack: 'backend', techStack: 'python-fastapi' });

    expect(config).toContain('PEP 8');
    expect(config).toContain('Pydantic');
    expect(config).toContain('Alembic');
    expect(config).toContain('authentication and authorization');
    expect(config).toContain('Tech Stack: Python 3.10+, FastAPI');
    expect(config).not.toContain('Javadoc');
    expect(config).not.toContain('Flyway');
  });

  it('assembles typescript frontend rules and UI fragments', async () => {
    const config = await compose({ stack: 'frontend', techStack: 'react-vite' });

    expect(config).toContain('schema: frontend');
    expect(config).toContain('JSDoc');
    expect(config).toContain('hammer');
    expect(config).toContain('browser/device compatibility');
    expect(config).not.toContain('Flyway');
    expect(config).not.toContain('Javadoc');
    expect(config).not.toContain('authentication and authorization');
  });

  it('composes java-react from java + typescript fragments', async () => {
    const config = await compose({ stack: 'fullstack', techStack: 'java-react' });

    expect(config).toContain('schema: fullstack');
    expect(config).toContain('【后端】所有新编写的方法');
    expect(config).toContain('【前端】所有新编写的函数/组件');
    expect(config).toContain('Backend: Java 17+, Spring Boot 3.x, Maven/Gradle');
    expect(config).toContain('Frontend: React 18+, TypeScript, Vite');
    expect(config).toContain('languages: [java, typescript]');
    expect(config).toContain('Flyway/Liquibase');
    expect(config).toContain('authentication and authorization');
    expect(config).toContain('hammer');
    expect(config).not.toContain('PEP 8');
  });

  it('composes python-react from python + typescript fragments', async () => {
    const config = await compose({ stack: 'fullstack', techStack: 'python-react' });

    expect(config).toContain('【后端】所有代码必须遵循 PEP 8');
    expect(config).toContain('【前端】所有新编写的函数/组件');
    expect(config).toContain('Backend: Python 3.10+, FastAPI');
    expect(config).toContain('Alembic');
    expect(config).toContain('languages: [python, typescript]');
    expect(config).not.toContain('Javadoc');
    expect(config).not.toContain('Flyway');
  });

  it('selects english language fragments', async () => {
    const config = await compose({
      stack: 'fullstack',
      techStack: 'python-react',
      language: 'en',
    });

    expect(config).toContain('language: en');
    expect(config).toContain(
      'All documents, specs, proposals, designs, and tasks MUST be written in English',
    );
    expect(config).toContain('[Backend] All code MUST follow PEP 8 style guide');
    expect(config).toContain('[Frontend] Every newly written function/component');
  });

  it('falls back to default languages when tech stack is omitted', async () => {
    const config = await compose({ stack: 'backend' });
    expect(config).toContain('Javadoc');
    expect(config).toContain('Tech Stack: Java 17+, Spring Boot 3.x, Maven/Gradle');
  });
});
