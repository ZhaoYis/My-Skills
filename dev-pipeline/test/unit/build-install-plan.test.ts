import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_FEATURE_IDS, type ToolAdapter, type ToolId } from '../../src/core/adapters/types.js';
import {
  buildInstallPlan,
  buildTemplateContext,
  normalizeBundleEntry,
} from '../../src/core/init/buildInstallPlan.js';
import { renderTemplate } from '../../src/core/init/renderTemplates.js';
import type { ManagedAssetRecord } from '../../src/core/manifest/types.js';
import {
  PACKAGE_LICENSE,
  PACKAGE_NAME,
  PACKAGE_REPO_URL,
  PACKAGE_VERSION,
} from '../../src/core/runtime/meta.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const createdDirs: string[] = [];
const standaloneCommands = [
  'propose',
  'apply',
  'archive',
  'verify',
  'sync',
  'explore',
  'dev-spec-design',
] as const;

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempTargetDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-build-plan-'));
  createdDirs.push(dir);
  return dir;
}

function createAdapter(
  id: ToolId,
  skills: string,
  commands: string,
  displayName: string,
): ToolAdapter {
  return {
    definition: {
      id,
      displayName,
      description: `${displayName} adapter`,
      markers: [skills.split('/')[0]],
      destinations: {
        root: '.',
        skills,
        commands,
      },
      supports: ['base', 'skills', 'commands', 'docs'],
    },
    detectFiles: () => [skills.split('/')[0]],
    supports: () => true,
    getDestination: (feature) => (feature === 'skills' ? skills : commands),
    supportsUserDestination: () => true,
    getRoot: () => '.',
    getSkillRootNote: () => undefined,
    getPostInstallNotes: () => ['note'],
  };
}

function createPlanInput(managedAssets?: ManagedAssetRecord[]) {
  const adapter = createAdapter('claude', '.claude/skills', '.claude/commands', 'claude');
  const registry = new Map<ToolId, ToolAdapter>([['claude', adapter]]);

  return {
    rootDir: PACKAGE_ROOT,
    targetDir: '/tmp/demo',
    projectName: 'demo',
    tool: 'claude' as const,
    features: [...ALL_FEATURE_IDS],
    scope: 'project' as const,
    dryRun: true,
    force: false,
    mode: 'init' as const,
    managedAssets,
    registry,
  };
}

describe('buildInstallPlan', () => {
  it('normalizes bundle entry separators for stable asset ids', () => {
    expect(normalizeBundleEntry('templates\\api_design.md.hbs')).toBe(
      'templates/api_design.md.hbs',
    );
  });

  it('builds shared package metadata and expands a custom skill root note', async () => {
    const context = buildTemplateContext({
      projectName: 'demo',
      toolId: 'claude',
      toolName: 'Claude Code',
      stack: 'backend',
      language: 'zh',
      features: ['skills'],
      skillsDir: '.custom/skills',
      commandsDir: '.custom/commands',
      skillRootNote: '- Custom root: `{skillsDir}/opsx-dev-pipeline`',
      techStack: 'java-spring-boot',
      techStackName: 'Java Spring Boot',
    });

    expect(context).toMatchObject({
      packageName: PACKAGE_NAME,
      packageVersion: PACKAGE_VERSION,
      packageLicense: PACKAGE_LICENSE,
      packageRepoUrl: PACKAGE_REPO_URL,
      skillRootNote: '- Custom root: `.custom/skills/opsx-dev-pipeline`',
      askTool: 'AskUserQuestion',
      techStack: 'java-spring-boot',
      techStackName: 'Java Spring Boot',
    });

    const rendered = await renderTemplate(
      path.join(PACKAGE_ROOT, 'src/templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs'),
      context,
    );
    expect(rendered).toContain('- Custom root: `.custom/skills/opsx-dev-pipeline`');
    expect(rendered).not.toContain('- 对于 Claude Code 安装：');
  });

  it.each([
    ['backend', 'java-spring-boot', 'config.backend.java-spring-boot.yaml.hbs'],
    ['frontend', 'react-vite', 'config.frontend.react-vite.yaml.hbs'],
    ['fullstack', 'java-react', 'config.fullstack.java-react.yaml.hbs'],
  ] as const)('selects the %s tech stack config template', async (stack, techStack, template) => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      stack,
      techStack,
    });

    expect(plan.techStack).toBe(techStack);
    expect(
      plan.files.find((file) => file.assetId === 'stack-config')?.sourcePath.endsWith(template),
    ).toBe(true);
  });

  it.each([
    ['zh', 'README.md.zh.hbs', 'CLAUDE.md.zh.hbs'],
    ['en', 'README.md.en.hbs', 'CLAUDE.md.en.hbs'],
  ] as const)('selects %s templates and falls back to unlocalized templates', async (language, readme, claude) => {
    const plan = await buildInstallPlan({ ...createPlanInput(), language });

    expect(plan.language).toBe(language);
    expect(
      plan.files.find((file) => file.assetId === 'common-readme')?.sourcePath.endsWith(readme),
    ).toBe(true);
    expect(
      plan.files.find((file) => file.assetId === 'claude-docs')?.sourcePath.endsWith(claude),
    ).toBe(true);
    expect(
      plan.files
        .find((file) => file.assetId === 'stack-config')
        ?.sourcePath.endsWith('config.backend.yaml.hbs'),
    ).toBe(true);
  });

  it('selects the fullstack config template', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      stack: 'fullstack',
      language: 'en',
    });

    expect(
      plan.files
        .find((file) => file.assetId === 'stack-config')
        ?.sourcePath.endsWith('config.fullstack.yaml.hbs'),
    ).toBe(true);
  });

  it('includes only the fullstack schema bundle for the fullstack stack', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      stack: 'fullstack',
      language: 'en',
    });
    const schemaBundleFiles = plan.files.filter((file) => file.assetId.includes('-schema-bundle:'));

    expect(schemaBundleFiles).toHaveLength(6);
    expect(
      schemaBundleFiles.every((file) => file.assetId.startsWith('fullstack-schema-bundle:')),
    ).toBe(true);
    expect(
      schemaBundleFiles.every((file) =>
        file.destinationPath.startsWith(path.join('/tmp/demo', 'openspec/schemas/fullstack')),
      ),
    ).toBe(true);
  });

  it.each([
    'backend',
    'fullstack',
  ] as const)('includes the API design artifact for the %s stack', async (stack) => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      stack,
      language: 'en',
    });
    const assetId = `${stack}-schema-bundle:templates/api_design.md.hbs`;
    const apiDesignFile = plan.files.find((file) => file.assetId === assetId);
    const schemaTemplate = await fs.readFile(
      path.join(PACKAGE_ROOT, 'src/templates/common/schemas', stack, 'schema.yaml.hbs'),
      'utf8',
    );

    expect(apiDesignFile?.destinationPath).toBe(
      path.join('/tmp/demo', 'openspec/schemas', stack, 'templates/api_design.md'),
    );
    expect(schemaTemplate).toContain('id: api-design');
    expect(schemaTemplate).toContain('generates: api_design.md');
    expect(schemaTemplate).toContain('template: api_design.md');
    expect(schemaTemplate).toContain('- api-design');
  });

  it('keeps fullstack artifacts backend-first', async () => {
    const templateRoot = path.join(PACKAGE_ROOT, 'src/templates/common/schemas/fullstack/templates');
    const [proposalTemplate, designTemplate, specTemplate, tasksTemplate] = await Promise.all([
      fs.readFile(path.join(templateRoot, 'proposal.md.hbs'), 'utf8'),
      fs.readFile(path.join(templateRoot, 'design.md.hbs'), 'utf8'),
      fs.readFile(path.join(templateRoot, 'spec.md.hbs'), 'utf8'),
      fs.readFile(path.join(templateRoot, 'tasks.md.hbs'), 'utf8'),
    ]);

    expect(proposalTemplate.indexOf('### Backend Changes')).toBeLessThan(
      proposalTemplate.indexOf('### Frontend Changes'),
    );
    expect(proposalTemplate).toContain(
      'Backend and frontend implementation must not run in parallel',
    );
    expect(designTemplate).toContain('## Backend Design');
    expect(designTemplate).toContain('## Frontend Design');
    expect(designTemplate.indexOf('## Backend Design')).toBeLessThan(
      designTemplate.indexOf('## Frontend Design'),
    );
    expect(designTemplate).toContain(
      'Backend and frontend implementation must not run in parallel',
    );
    expect(specTemplate.indexOf('### Requirement: <Backend API Requirement Name>')).toBeLessThan(
      specTemplate.indexOf('### Requirement: <Frontend Requirement Name>'),
    );
    expect(specTemplate).toContain(
      'Frontend behavior must be derived from the finalized backend contract',
    );
    expect(
      specTemplate.indexOf('### Requirement: <Backend API Requirement Being Removed>'),
    ).toBeLessThan(
      specTemplate.indexOf('### Requirement: <Dependent Frontend Requirement Being Removed>'),
    );
    expect(tasksTemplate.indexOf('## 2. Backend Completion Gate')).toBeLessThan(
      tasksTemplate.indexOf('## 3. Frontend Implementation'),
    );
    expect(tasksTemplate).toContain(
      'Start this section only after every task in Section 2 is complete',
    );
  });

  it('selects one localized bundle template and removes its language suffix', async () => {
    const rootDir = await createTempTargetDir();
    // Create skill directories for all 'skills' feature bundles
    for (const skill of ['opsx-dev-pipeline', 'grill-me', 'grilling', 'dev-spec-design']) {
      await fs.ensureDir(path.join(rootDir, 'src/templates/common/skills', skill, 'agents'));
    }
    const sourceRoot = path.join(rootDir, 'src/templates/common/skills/opsx-dev-pipeline');
    await fs.writeFile(path.join(sourceRoot, 'guide.en.hbs'), '# English\n');
    await fs.writeFile(path.join(sourceRoot, 'guide.zh.hbs'), '# 中文\n');
    await fs.writeFile(path.join(sourceRoot, 'fallback.md.hbs'), '# fallback\n');

    const plan = await buildInstallPlan({
      ...createPlanInput(),
      rootDir,
      features: ['skills'],
      language: 'en',
    });

    expect(plan.files.map((file) => path.basename(file.sourcePath)).sort()).toEqual([
      'fallback.md.hbs',
      'guide.en.hbs',
    ]);
    expect(plan.files.map((file) => path.basename(file.destinationPath)).sort()).toEqual([
      'fallback.md',
      'guide',
    ]);
  });

  it.each([
    ['claude', '.claude/skills', '.claude/commands', 'CLAUDE.md'],
    ['cursor', '.cursor/rules', '.cursor/commands', '.cursor/rules/opsx-dev-pipeline.mdc'],
    ['codex', '.codex/prompts', '.codex/commands', '.codex/prompts/opsx-dev-pipeline.md'],
  ] as const)('maps assets for %s including bundle skill', async (tool, skillsDir, commandsDir, docsPath) => {
    const adapter = createAdapter(tool, skillsDir, commandsDir, tool);
    const registry = new Map<ToolId, ToolAdapter>([[tool, adapter]]);

    const plan = await buildInstallPlan({
      rootDir: PACKAGE_ROOT,
      targetDir: '/tmp/demo',
      projectName: 'demo',
      tool,
      features: [...ALL_FEATURE_IDS],
      scope: 'project',
      dryRun: true,
      force: false,
      mode: 'init',
      registry,
    });

    expect(
      plan.files.some((file) => file.destinationPath === path.join('/tmp/demo', docsPath)),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'SKILL.md'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join(
            '/tmp/demo',
            skillsDir,
            'opsx-dev-pipeline',
            'references',
            'phase-0-entrance.md',
          ),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'scripts', 'archive.mjs'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'opsx-dev-pipeline', 'scripts', 'preflight.mjs'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath === path.join('/tmp/demo', skillsDir, 'grill-me', 'SKILL.md'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'grill-me', 'agents', 'openai.yaml'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath === path.join('/tmp/demo', skillsDir, 'grilling', 'SKILL.md'),
      ),
    ).toBe(true);
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath ===
          path.join('/tmp/demo', skillsDir, 'grilling', 'agents', 'openai.yaml'),
      ),
    ).toBe(true);
    for (const skillFile of [
      'SKILL.md',
      'references/system-analysis-design-template-lite.md',
      'agents/openai.yaml',
    ]) {
      expect(
        plan.files.some(
          (file) =>
            file.destinationPath ===
            path.join('/tmp/demo', skillsDir, 'dev-spec-design', skillFile),
        ),
      ).toBe(true);
    }
    expect(
      plan.files.some(
        (file) =>
          file.destinationPath === path.join('/tmp/demo', commandsDir, 'opsx-dev-pipeline.md'),
      ),
    ).toBe(true);
    for (const command of standaloneCommands) {
      expect(
        plan.files.some(
          (file) =>
            file.destinationPath === path.join('/tmp/demo', commandsDir, 'opsx', `${command}.md`),
        ),
      ).toBe(true);
    }
    // negative: no removed preset skills or commands in plan
    const removed = [
      'opsx-learn',
      'opsx-analysis',
      'opsx-design',
      'opsx-verify',
      'opsx-clarify',
      'opsx-health',
      'opsx-pr',
      'opsx-prototype',
      'opsx-ci-triage',
      'git-commit-push',
      'git-code-review',
      'git-merge-branch',
      'file-code-review',
    ];
    for (const name of removed) {
      expect(plan.files.some((file) => file.destinationPath.includes(name))).toBe(false);
    }
  });

  it('marks existing files as unresolved during init without force', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
    });

    const readmeFile = plan.files.find((file) => file.assetId === 'common-readme');
    expect(readmeFile?.resolution).toBe('none');
  });

  it('marks existing files as overwrite when force is enabled', async () => {
    const targetDir = await createTempTargetDir();
    await fs.writeFile(path.join(targetDir, 'README.md'), '# existing\n');

    const plan = await buildInstallPlan({
      ...createPlanInput(),
      targetDir,
      force: true,
    });

    const readmeFile = plan.files.find((file) => file.assetId === 'common-readme');
    expect(readmeFile?.resolution).toBe('overwrite');
  });

  it('replaces OpenSpec-generated command entries only during init', async () => {
    const targetDir = await createTempTargetDir();
    const commandPath = path.join(targetDir, '.claude/commands/opsx/propose.md');
    await fs.ensureDir(path.dirname(commandPath));
    await fs.writeFile(commandPath, '# OpenSpec generated\n');
    await fs.writeFile(path.join(targetDir, 'README.md'), '# existing\n');

    const initPlan = await buildInstallPlan({ ...createPlanInput(), targetDir });
    expect(initPlan.files.find((file) => file.assetId === 'opsx-propose-command')?.resolution).toBe(
      'overwrite',
    );
    expect(initPlan.files.find((file) => file.assetId === 'common-readme')?.resolution).toBe(
      'unresolved',
    );

    const syncPlan = await buildInstallPlan({
      ...createPlanInput([
        { id: 'opsx-propose-command', destination: '.claude/commands/opsx/propose.md' },
      ]),
      targetDir,
      mode: 'sync',
    });
    expect(syncPlan.files).toHaveLength(1);
    expect(syncPlan.files[0]).toMatchObject({
      assetId: 'opsx-propose-command',
      resolution: 'unresolved',
    });
  });

  it.each([
    ['.claude/skills', '.claude/commands'],
    ['.cursor/rules', '.cursor/commands'],
    ['.codex/prompts', '.codex/commands'],
  ] as const)('renders standalone command templates for %s', async (skillsDir, commandsDir) => {
    for (const command of standaloneCommands) {
      const rendered = await renderTemplate(
        path.join(PACKAGE_ROOT, 'src/templates/common/commands/opsx', `${command}.md.hbs`),
        { skillsDir, commandsDir, askTool: 'AskUserQuestion' },
      );

      expect(rendered).toContain(
        `node ${skillsDir}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs`,
      );
      expect(rendered).not.toMatch(/\{\{[^}]+\}\}/);
      if (command === 'explore') {
        expect(rendered).toContain('featureInfo');
        expect(rendered).toContain('Do not collect or persist metadata in explore mode.');
      } else if (command === 'dev-spec-design') {
        expect(rendered).toContain('AskUserQuestion');
        expect(rendered).toMatch(/^allowed-tools: .*AskUserQuestion$/m);
        expect(rendered).toContain(`${skillsDir}/dev-spec-design/SKILL.md`);
        expect(rendered).toContain('Never initialize, migrate, or modify pipeline state.');
        expect(rendered).not.toContain(' --feature-id ');
      } else {
        expect(rendered).toContain('AskUserQuestion');
        expect(rendered).toMatch(/^allowed-tools: .*AskUserQuestion$/m);
        expect(rendered).toContain('MUST call AskUserQuestion and wait for an explicit choice');
        expect(rendered).toContain('--feature-id "<featureId>"');
        expect(rendered).toContain('--feature-url "<featureUrl>"');
        expect(rendered).toContain('--skip-feature-association');
        expect(rendered).not.toContain('[--feature-url');
      }
    }
  });

  it('marks sync files as unresolved without force', async () => {
    const managedAssets: ManagedAssetRecord[] = [{ id: 'common-readme', destination: 'README.md' }];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync',
    });

    expect(plan.files[0]?.resolution).toBe('none');
  });

  it('keeps the managed root .gitignore during init when force is enabled', async () => {
    const plan = await buildInstallPlan({
      ...createPlanInput(),
      force: true,
    });

    const gitignoreFile = plan.files.find((file) => file.assetId === 'common-gitignore');
    expect(gitignoreFile?.resolution).toBe('none');
  });

  it('limits sync plans to manifest-managed assets and full managed bundles', async () => {
    const managedAssets: ManagedAssetRecord[] = [
      { id: 'common-readme', destination: 'README.md' },
      { id: 'opsx-dev-pipeline-command', destination: '.claude/commands/opsx-dev-pipeline.md' },
      {
        id: 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
        destination: '.claude/skills/opsx-dev-pipeline/SKILL.md',
      },
    ];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'sync',
    });

    const assetIds = plan.files.map((file) => file.assetId).sort();
    expect(assetIds).toContain('common-readme');
    expect(assetIds).toContain('opsx-dev-pipeline-command');
    expect(assetIds).toContain('opsx-dev-pipeline-skill-bundle:SKILL.md.hbs');
    expect(
      assetIds.every((id) => id === 'common-readme' || id.startsWith('opsx-dev-pipeline')),
    ).toBe(true);
  });

  it('adopts newly added package assets during upgrade', async () => {
    const managedAssets: ManagedAssetRecord[] = [{ id: 'common-readme', destination: 'README.md' }];

    const plan = await buildInstallPlan({
      ...createPlanInput(managedAssets),
      mode: 'upgrade',
    });

    expect(plan.files.some((file) => file.assetId === 'opsx-dev-pipeline-command')).toBe(true);
    expect(
      plan.files.some((file) => file.assetId.startsWith('opsx-dev-pipeline-skill-bundle:')),
    ).toBe(true);
  });
});
