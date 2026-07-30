import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDoctorCommand } from '../../src/cli/commands/doctor.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

import { runSyncCommand } from '../../src/cli/commands/sync.js';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import { runUpgradeCommand } from '../../src/cli/commands/upgrade.js';
import { runInit as runInitImpl } from '../../src/core/init/runInit.js';
import { readManifest as readStoredManifest } from '../../src/core/manifest/io.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';
import {
  MANIFEST_FILE,
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_JSON_FILE,
  PACKAGE_LICENSE,
  PACKAGE_REPO_URL,
  PACKAGE_VERSION,
} from '../../src/core/runtime/meta.js';

const createdDirs: string[] = [];

async function runInit(options: Parameters<typeof runInitImpl>[0]): Promise<void> {
  await runInitImpl({ stack: 'backend', ...options });
}

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function readManifest(dir: string): Promise<PipelineManifest> {
  const result = await readStoredManifest(dir);
  if (!result) {
    throw new Error('Manifest not found');
  }

  return result.manifest;
}

async function listAllFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      results.push(fullPath);
      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }
  await walk(root);
  return results;
}

const removed = [
  'opsx-learn',
  'opsx-analysis',
  'opsx-design',
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

const toolExpectations = {
  claude: [
    { path: 'CLAUDE.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/references/phase-6-merge-push.md', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/scripts/preflight.mjs', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/scripts/archive.mjs', present: true },
    { path: '.claude/skills/opsx-dev-pipeline/agents/openai.yaml', present: true },
    { path: '.claude/skills/grill-me/SKILL.md', present: true },
    { path: '.claude/skills/grill-me/agents/openai.yaml', present: true },
    { path: '.claude/skills/grilling/SKILL.md', present: true },
    { path: '.claude/skills/grilling/agents/openai.yaml', present: true },
    { path: '.claude/commands/opsx-dev-pipeline.md', present: true },
    ...['propose', 'apply', 'archive', 'verify', 'sync', 'explore'].map((command) => ({
      path: `.claude/commands/opsx/${command}.md`,
      present: true as const,
    })),
  ],
  cursor: [
    { path: '.cursor/rules/opsx-dev-pipeline.mdc', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/references/phase-6-merge-push.md', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/scripts/preflight.mjs', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/scripts/archive.mjs', present: true },
    { path: '.cursor/rules/opsx-dev-pipeline/agents/openai.yaml', present: true },
    { path: '.cursor/rules/grill-me/SKILL.md', present: true },
    { path: '.cursor/rules/grill-me/agents/openai.yaml', present: true },
    { path: '.cursor/rules/grilling/SKILL.md', present: true },
    { path: '.cursor/rules/grilling/agents/openai.yaml', present: true },
    { path: '.cursor/commands/opsx-dev-pipeline.md', present: true },
    ...['propose', 'apply', 'archive', 'verify', 'sync', 'explore'].map((command) => ({
      path: `.cursor/commands/opsx/${command}.md`,
      present: true as const,
    })),
    { path: '.cursor/commands/README.md', present: true },
  ],
  codex: [
    { path: '.codex/prompts/opsx-dev-pipeline.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/SKILL.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/references/phase-0-entrance.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/references/phase-6-merge-push.md', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/scripts/preflight.mjs', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/scripts/archive.mjs', present: true },
    { path: '.codex/prompts/opsx-dev-pipeline/agents/openai.yaml', present: true },
    { path: '.codex/prompts/grill-me/SKILL.md', present: true },
    { path: '.codex/prompts/grill-me/agents/openai.yaml', present: true },
    { path: '.codex/prompts/grilling/SKILL.md', present: true },
    { path: '.codex/prompts/grilling/agents/openai.yaml', present: true },
    { path: '.codex/commands/opsx-dev-pipeline.md', present: true },
    ...['propose', 'apply', 'archive', 'verify', 'sync', 'explore'].map((command) => ({
      path: `.codex/commands/opsx/${command}.md`,
      present: true as const,
    })),
    { path: '.codex/commands/README.md', present: true },
  ],
} as const;

const askToolExpectations = {
  claude: {
    skillRoot: '.claude/skills/opsx-dev-pipeline',
    commandsRoot: '.claude/commands/opsx',
    askTool: 'AskUserQuestion',
  },
  cursor: {
    skillRoot: '.cursor/rules/opsx-dev-pipeline',
    commandsRoot: '.cursor/commands/opsx',
    askTool: 'AskQuestion',
  },
  codex: {
    skillRoot: '.codex/prompts/opsx-dev-pipeline',
    commandsRoot: '.codex/commands/opsx',
    askTool: 'AskUserQuestion',
  },
} as const;

describe('tool matrix', () => {
  it.each(
    Object.entries(toolExpectations),
  )('initializes %s successfully', async (tool, expectations) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-${tool}-`));
    createdDirs.push(dir);

    await runInit({
      dir,
      tool: tool as 'claude' | 'cursor' | 'codex',
      yes: true,
      force: false,
      dryRun: false,
    });

    for (const { path: file, present } of expectations) {
      if (present) {
        expect(await fs.pathExists(path.join(dir, file))).toBe(true);
      } else {
        expect(await fs.pathExists(path.join(dir, file))).toBe(false);
      }
    }

    const { skillRoot, commandsRoot, askTool } =
      askToolExpectations[tool as keyof typeof askToolExpectations];
    const skill = await fs.readFile(path.join(dir, skillRoot, 'SKILL.md'), 'utf8');
    const devPipelineState = await fs.readFile(
      path.join(dir, skillRoot, 'scripts/dev-pipeline-state.mjs'),
      'utf8',
    );
    const entrance = await fs.readFile(
      path.join(dir, skillRoot, 'references/phase-0-entrance.md'),
      'utf8',
    );
    const propose = await fs.readFile(path.join(dir, commandsRoot, 'propose.md'), 'utf8');
    expect(skill).toContain(`决策点首选 **${askTool}** tool`);
    expect(entrance).toContain(`必须使用 **${askTool}** 询问用户是否关联外部需求`);
    expect(propose).toMatch(new RegExp(`^allowed-tools: Bash\\(openspec:\\*\\), ${askTool}$`, 'm'));
    expect(propose).toContain(`MUST call ${askTool} and wait for an explicit choice`);
    expect([skill, entrance, propose].join('\n')).not.toMatch(/\{\{[^}]+\}\}/);
    expect(devPipelineState).toContain('-----BEGIN PUBLIC KEY-----');
    expect(devPipelineState).not.toContain('PRIVATE KEY');

    // Negative: no removed preset skills or commands in any adapter output
    const allFiles = await listAllFiles(dir);
    for (const name of removed) {
      expect(
        allFiles.filter((file) => {
          const normalized = file.replaceAll('\\\\', '/');
          return (
            normalized.endsWith(`/${name}`) ||
            normalized.endsWith(`/${name}.md`) ||
            normalized.includes(`/${name}/`)
          );
        }),
      ).toEqual([]);
    }

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
    // Negative: no tests directory with leaked legacy content
    expect(
      await fs.pathExists(
        path.join(dir, expectations[0].path.split('/').slice(0, -1).join('/'), 'tests'),
      ),
    ).toBe(false);
  });

  it('rejects removed optional features before installation', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-reject-removed-feature-'));
    createdDirs.push(dir);

    for (const removedFeature of ['prototype', 'opsx-pr', 'opsx-ci-triage']) {
      await expect(
        runInit({
          dir,
          tool: 'claude',
          yes: true,
          force: false,
          dryRun: true,
          feature: [removedFeature],
        }),
      ).rejects.toThrow(/Unknown feature/);
    }
  });

  it('default init includes all base features', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-feature-default-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    const defaultManifest = await readManifest(dir);
    expect(defaultManifest.features.sort()).toEqual([
      'base',
      'commands',
      'docs',
      'schema',
      'skills',
    ]);
  });

  it.each([
    'frontend',
    'backend',
    'fullstack',
  ] as const)('installs the %s OpenSpec schema only', async (stack) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-stack-${stack}-`));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', stack, yes: true, force: false, dryRun: false });

    const selectedSchema = path.join(dir, 'openspec', 'schemas', stack, 'schema.yaml');
    const apiDesignTemplate = path.join(
      dir,
      'openspec',
      'schemas',
      stack,
      'templates',
      'api_design.md',
    );
    expect(await fs.pathExists(selectedSchema)).toBe(true);
    expect(await fs.pathExists(apiDesignTemplate)).toBe(stack !== 'frontend');
    for (const otherStack of ['frontend', 'backend', 'fullstack'].filter(
      (candidate) => candidate !== stack,
    )) {
      expect(await fs.pathExists(path.join(dir, 'openspec', 'schemas', otherStack))).toBe(false);
    }
    expect(await fs.readFile(path.join(dir, 'openspec', 'config.yaml'), 'utf8')).toContain(
      `schema: ${stack}`,
    );
    expect((await readManifest(dir)).stack).toBe(stack);
  });

  it('embeds manifest in package.json when package.json exists', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-package-json-'));
    createdDirs.push(dir);

    await fs.writeJson(path.join(dir, PACKAGE_JSON_FILE), {
      name: 'demo-app',
      version: '1.0.0',
    });

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);

    const pkg = await fs.readJson(path.join(dir, PACKAGE_JSON_FILE));
    expect(pkg[MANIFEST_PACKAGE_JSON_KEY].tool).toBe('claude');
    expect(pkg[MANIFEST_PACKAGE_JSON_KEY].managedAssets.length).toBeGreaterThan(0);
  });

  it('supports dry-run without writing files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-dry-run-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: true });
    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);
  });

  it('supports doctor, sync, and upgrade on an initialized repo', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-lifecycle-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await runDoctorCommand(dir);
    await runSyncCommand({ dir, force: true, dryRun: false });
    await runUpgradeCommand({ dir, force: true, dryRun: false });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(true);
  });

  it('doctor reports current manifest version after init', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-doctor-version-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const status = await runDoctorCommand(dir, true);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      manifest: {
        versionCheck: { status: string };
      };
    };
    logSpy.mockRestore();

    expect(status).not.toBe('fail');
    expect(payload.manifest.versionCheck.status).toBe('current');
  });

  it('embeds the pipeline phases and decision points in skill references', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-gates-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const skillRoot = path.join(dir, '.claude/skills/opsx-dev-pipeline');

    // Verify SKILL.md navigation hub
    const skillContent = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    expect(skillContent).toContain('Phase引用表');
    expect(skillContent).toContain('执行约束');
    expect(skillContent).toContain('错误处理速查');
    expect(skillContent).toContain('migrate-schema');
    expect(skillContent).toContain('record-phase');
    expect(skillContent).toContain('executionMode');
    expect(skillContent).toContain('「继续后续流程」选项仅跳过当前 Phase');
    expect(skillContent).toContain('必须先执行 `transition` 命令并通过门禁验证');

    // Verify all phase reference files exist
    for (const phase of [0, 1, 2, 3, 4, 5, 6]) {
      expect(
        await fs.pathExists(path.join(skillRoot, `references/phase-${phase}-entrance.md`)),
      ).toBe(phase === 0);
      if (phase !== 0) {
        const phaseName =
          phase === 4
            ? 'unit-tests'
            : phase === 5
              ? 'archive'
              : phase === 6
                ? 'merge-push'
                : ['propose', 'apply', 'review'][phase - 1];
        expect(
          await fs.pathExists(path.join(skillRoot, `references/phase-${phase}-${phaseName}.md`)),
        ).toBe(true);
      }
    }

    // Verify key content in phase files
    const apply = await fs.readFile(path.join(skillRoot, 'references/phase-2-apply.md'), 'utf8');
    expect(apply).toContain('写前复用门禁');
    expect(apply).toContain('准出自审查门禁');
    expect(apply).toContain('编辑 `tasks.md` 将该任务条目的 `- [ ]` 改为 `- [x]`，完成标记');

    const propose = await fs.readFile(
      path.join(skillRoot, 'references/phase-1-propose.md'),
      'utf8',
    );
    expect(propose).toContain('决策点 1a');
    expect(propose).toContain('需求理解确认');

    const entrance = await fs.readFile(
      path.join(skillRoot, 'references/phase-0-entrance.md'),
      'utf8',
    );
    expect(entrance).toContain('检测到非 pipeline 执行模式');
    expect(entrance).toContain('phaseHistory');
    expect(entrance).toContain('gate 补偿');
    expect(entrance).toContain('postArchiveAction');
    expect(entrance).toContain('首次创建状态的统一规则');
    expect(entrance).toContain('必须使用 **AskUserQuestion** 询问用户是否关联外部需求');
    expect(entrance).toContain('--feature-id "<featureId>"');
    expect(entrance).toContain('--feature-id "<featureId>" --feature-url "<featureUrl>"');
    expect(entrance).toContain('--skip-feature-association');
    expect(entrance).toContain('不得推断为跳过');

    const review = await fs.readFile(path.join(skillRoot, 'references/phase-3-review.md'), 'utf8');
    expect(review).toContain('「继续后续流程」仅跳过修复当前审查发现的问题');
    expect(review).toContain('transition "<name>" 4 14');

    const unitTests = await fs.readFile(
      path.join(skillRoot, 'references/phase-4-unit-tests.md'),
      'utf8',
    );
    expect(unitTests).toContain('transition "<name>" 5 15');
    expect(unitTests).toContain('test-gate-required');

    const archive = await fs.readFile(
      path.join(skillRoot, 'references/phase-5-archive.md'),
      'utf8',
    );
    expect(archive).toContain('executionMode=standalone|hybrid');
    expect(archive).toContain('/opsx:verify <name>');
    expect(archive).toContain('禁止在未经用户显式确认的情况下使用 `-y` flag');
    expect(archive).toContain('transition "<name>" 6 20');

    // Verify scripts directory exists with essential scripts
    const scriptsDir = path.join(skillRoot, 'scripts');
    expect(await fs.pathExists(path.join(scriptsDir, 'preflight.mjs'))).toBe(true);
    expect(await fs.pathExists(path.join(scriptsDir, 'archive.mjs'))).toBe(true);
    expect(await fs.pathExists(path.join(scriptsDir, 'dev-pipeline-state.test.mjs'))).toBe(false);
  });

  it('renders tool display name in retained skills without template variables', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-tool-displayname-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    // Verify retained pipeline skill does not leak raw template variables
    const skillContent = await fs.readFile(
      path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'),
      'utf8',
    );
    expect(skillContent).not.toContain('{{toolName}}');
  });

  it.each([
    'claude',
    'cursor',
    'codex',
  ] as const)('renders valid skill metadata and tool entry semantics for %s', async (tool) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-metadata-${tool}-`));
    createdDirs.push(dir);

    await runInit({ dir, tool, yes: true, force: false, dryRun: false });
    const skillFile = toolExpectations[tool].find(({ path: file }) =>
      file.endsWith('/SKILL.md'),
    )?.path;
    if (!skillFile) {
      throw new Error(`SKILL.md expectation missing for ${tool}`);
    }
    const skillDir = path.dirname(path.join(dir, skillFile));
    const skillContent = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
    const frontmatter = skillContent.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';

    expect(frontmatter.match(/^name:/gm)).toHaveLength(1);
    expect(frontmatter.match(/^description:/gm)).toHaveLength(1);
    expect(frontmatter).toContain(`version: "${PACKAGE_VERSION}"`);
    expect(frontmatter).toContain(`license: "${PACKAGE_LICENSE}"`);
    expect(frontmatter).toContain(`repository: "${PACKAGE_REPO_URL}"`);
    expect(skillContent).not.toMatch(/\{\{[^}]+\}\}/);

    const expectedSkillRoot = {
      claude: '- 对于 Claude Code 安装：`<SKILL_ROOT>` = `.claude/skills/opsx-dev-pipeline`',
      cursor: '- 对于 Cursor 安装：`<SKILL_ROOT>` = `.cursor/rules/opsx-dev-pipeline`',
      codex: '- 对于 Codex 安装：`<SKILL_ROOT>` = `.codex/prompts/opsx-dev-pipeline`',
    }[tool];
    expect(skillContent.match(/^- 对于 .*安装：.*$/gm)).toEqual([expectedSkillRoot]);
    expect(skillContent).toContain(
      '- 若宿主将 Skill 安装到其他位置，`<SKILL_ROOT>` = 当前 `SKILL.md` 所在目录',
    );

    const openaiConfig = await fs.readFile(path.join(skillDir, 'agents/openai.yaml'), 'utf8');
    expect(openaiConfig).toContain('display_name: "OpenSpec Dev Pipeline"');
    expect(openaiConfig).toContain('Use $opsx-dev-pipeline');
    expect(openaiConfig).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('keeps the Cursor rule opt-in', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-cursor-opt-in-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'cursor', yes: true, force: false, dryRun: false });
    const rule = await fs.readFile(path.join(dir, '.cursor/rules/opsx-dev-pipeline.mdc'), 'utf8');
    expect(rule).toContain('alwaysApply: false');
    expect(rule).not.toContain('alwaysApply: true');
  });

  it('writes a concise root README for new projects', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-generated-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    const readmeContent = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
    expect(readmeContent).toContain(`# ${path.basename(dir)}`);
    expect(readmeContent).toContain('## 快速开始');
    expect(readmeContent).not.toContain('## Enabled features');
  });

  it.each([
    ['zh', '## 快速开始', '所有文档、规格、提案、设计和任务必须使用简体中文编写'],
    [
      'en',
      '## Quick start',
      'All documents, specs, proposals, designs, and tasks MUST be written in English',
    ],
  ] as const)('persists %s and renders localized user-facing templates', async (language, readmeHeading, languageRule) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `opsx-language-${language}-`));
    createdDirs.push(dir);

    await runInit({
      dir,
      tool: 'claude',
      language,
      yes: true,
      force: false,
      dryRun: false,
    });

    expect((await readManifest(dir)).language).toBe(language);
    expect(await fs.readFile(path.join(dir, 'README.md'), 'utf8')).toContain(readmeHeading);
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toContain(readmeHeading);
    const config = await fs.readFile(path.join(dir, 'openspec/config.yaml'), 'utf8');
    expect(config).toContain(`language: ${language}`);
    expect(config).toContain(languageRule);
  });

  it('backfills language during sync for a legacy manifest without the schema feature', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-language-backfill-'));
    createdDirs.push(dir);
    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      schemaVersion: 1,
      projectName: 'legacy-demo',
      tool: 'claude',
      stack: 'frontend',
      features: [],
      templateVersion: '0.2.1',
      packageName: 'opsx-dev-pipeline',
      managedAssets: [],
    });
    await fs.outputFile(
      path.join(dir, 'openspec/config.yaml'),
      'schema: frontend\ncontext: |\n  Legacy context\nrules:\n  proposal:\n    - "Legacy rule"\n',
    );

    await runSyncCommand({ dir, language: 'en', force: false, dryRun: false });

    const config = await fs.readFile(path.join(dir, 'openspec/config.yaml'), 'utf8');
    expect(config).toContain('language: en');
    expect(config).toContain(
      'All documents, specs, proposals, designs, and tasks MUST be written in English',
    );
    expect(config).toContain('Legacy rule');
    expect((await readManifest(dir)).language).toBe('en');
  });

  it('preserves an existing root README during init without force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-existing-'));
    createdDirs.push(dir);
    const existingReadme = path.join(dir, 'README.md');
    const originalContent = '# Existing project\n';

    await fs.writeFile(existingReadme, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    expect(await fs.readFile(existingReadme, 'utf8')).toBe(originalContent);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-readme')).toBe(false);
  });

  it('overwrites an existing root README during init with force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-force-'));
    createdDirs.push(dir);
    const existingReadme = path.join(dir, 'README.md');

    await fs.writeFile(existingReadme, '# Existing project\n');
    await runInit({ dir, tool: 'claude', yes: true, force: true, dryRun: false });

    const readmeContent = await fs.readFile(existingReadme, 'utf8');
    expect(readmeContent).not.toBe('# Existing project\n');

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-readme')).toBe(true);
  });

  it('does not adopt a skipped root README during sync', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-readme-sync-'));
    createdDirs.push(dir);
    const existingReadme = path.join(dir, 'README.md');
    const originalContent = '# Existing project\n';

    await fs.writeFile(existingReadme, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await runSyncCommand({ dir, force: true, dryRun: false });

    expect(await fs.readFile(existingReadme, 'utf8')).toBe(originalContent);
    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-readme')).toBe(false);
  });

  it('preserves an existing root .gitignore during init without force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-gitignore-existing-'));
    createdDirs.push(dir);
    const existingGitignore = path.join(dir, '.gitignore');
    const originalContent = 'node_modules\n';

    await fs.writeFile(existingGitignore, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });

    expect(await fs.readFile(existingGitignore, 'utf8')).toBe(originalContent);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-gitignore')).toBe(false);
  });

  it('overwrites an existing root .gitignore during init with force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-gitignore-force-'));
    createdDirs.push(dir);
    const existingGitignore = path.join(dir, '.gitignore');

    await fs.writeFile(existingGitignore, 'node_modules\n');
    await runInit({ dir, tool: 'claude', yes: true, force: true, dryRun: false });

    const gitignoreContent = await fs.readFile(existingGitignore, 'utf8');
    expect(gitignoreContent).not.toBe('node_modules\n');

    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-gitignore')).toBe(true);
  });

  it('does not adopt a skipped root .gitignore during sync', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-gitignore-sync-'));
    createdDirs.push(dir);
    const existingGitignore = path.join(dir, '.gitignore');
    const originalContent = 'node_modules\n';

    await fs.writeFile(existingGitignore, originalContent);
    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await runSyncCommand({ dir, force: true, dryRun: false });

    expect(await fs.readFile(existingGitignore, 'utf8')).toBe(originalContent);
    const manifest = await readManifest(dir);
    expect(manifest.managedAssets.some((asset) => asset.id === 'common-gitignore')).toBe(false);
  });

  it('preserves managed assets when sync skips conflicts with yes enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-managed-assets-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    const before = await readManifest(dir);
    const managedCount = before.managedAssets.length;
    expect(managedCount).toBeGreaterThan(0);

    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');
    await runSyncCommand({ dir, yes: true, force: false, dryRun: false });

    const after = await readManifest(dir);
    expect(after.managedAssets.length).toBe(managedCount);
    expect(after.managedAssets.some((asset) => asset.id === 'claude-docs')).toBe(true);
  });

  it('sync skips conflicts when yes is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-yes-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    await runSyncCommand({ dir, yes: true, force: false, dryRun: false });
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('custom\n');
  });

  it('sync overwrites conflicts when force is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-force-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    await runSyncCommand({ dir, force: true, dryRun: false });
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).not.toBe('custom\n');
  });

  it('upgrade inherits sync conflict behavior when yes is enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-upgrade-yes-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    await runUpgradeCommand({ dir, yes: true, force: false, dryRun: false });
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('custom\n');
  });

  it('uninstall removes managed files and manifest with yes enabled', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-uninstall-full-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    expect(await readStoredManifest(dir)).not.toBeNull();

    await runUninstallCommand({ dir, yes: true, dryRun: false });

    expect(await readStoredManifest(dir)).toBeNull();
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(dir, '.claude/commands/opsx-dev-pipeline.md'))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(dir, 'CLAUDE.md'))).toBe(false);
  });

  it('sync prompts for conflicts without yes or force', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-sync-prompt-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude', yes: true, force: false, dryRun: false });
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'custom\n');

    vi.mocked(prompts).mockResolvedValue({ resolution: 'skip' });
    await runSyncCommand({ dir, yes: false, force: false, dryRun: false });

    expect(vi.mocked(prompts)).toHaveBeenCalled();
    expect(await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('custom\n');
  });
});
