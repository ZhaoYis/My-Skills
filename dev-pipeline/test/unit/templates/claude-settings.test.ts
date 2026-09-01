import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTemplateContext } from '../../../src/core/init/buildInstallPlan.js';
import { renderTemplate } from '../../../src/core/init/renderTemplates.js';

const TEMPLATE = path.resolve(
  process.cwd(),
  'src/templates/tools/claude/overlay/.claude/settings.json.hbs',
);

function context(hooksEnabled = true, skillsDir = '.claude/skills') {
  return buildTemplateContext({
    projectName: 'demo',
    toolId: 'claude',
    toolName: 'Claude Code',
    stack: 'backend',
    language: 'zh',
    features: ['base', 'skills', 'commands', 'docs', 'schema', 'hooks'],
    skillsDir,
    commandsDir: '.claude/commands',
    hooksEnabled,
  });
}

describe('claude settings.json.hbs', () => {
  it('renders valid JSON when hooksEnabled', async () => {
    const content = await renderTemplate(TEMPLATE, context(true));
    const parsed = JSON.parse(content);
    expect(parsed._opsxManaged.hooksEnabled).toBe(true);
    expect(parsed.hooks.PreToolUse).toHaveLength(2);
  });

  it('declares the Bash matcher with the dangerous-bash hook command', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    const bashEntry = parsed.hooks.PreToolUse.find(
      (e: { matcher: string }) => e.matcher === 'Bash',
    );
    expect(bashEntry).toBeDefined();
    expect(bashEntry.hooks[0].type).toBe('command');
    expect(bashEntry.hooks[0].command).toMatch(/block-dangerous-bash\.mjs$/);
    expect(bashEntry.hooks[0].timeout).toBe(5);
  });

  it('declares Write|Edit|MultiEdit matcher for the sensitive-write hook', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    const writeEntry = parsed.hooks.PreToolUse.find(
      (e: { matcher: string }) => e.matcher === 'Write|Edit|MultiEdit',
    );
    expect(writeEntry).toBeDefined();
    expect(writeEntry.hooks[0].command).toMatch(/block-sensitive-write\.mjs$/);
    expect(writeEntry.hooks[0].timeout).toBe(5);
  });

  it('uses {{skillsDir}} placeholder for relative hook paths', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    expect(parsed.hooks.PreToolUse[0].hooks[0].command).toContain(
      '.claude/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs',
    );
    expect(parsed.hooks.PreToolUse[1].hooks[0].command).toContain(
      '.claude/skills/opsx-dev-pipeline/scripts/hooks/block-sensitive-write.mjs',
    );
  });

  it('emits empty hooks array when hooksEnabled is false', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(false)));
    expect(parsed._opsxManaged.hooksEnabled).toBe(false);
    expect(parsed.hooks.PreToolUse).toEqual([]);
  });

  it('still produces valid JSON when hooksEnabled is false', async () => {
    const content = await renderTemplate(TEMPLATE, context(false));
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('embeds package metadata in _opsxManaged', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    expect(parsed._opsxManaged.package).toBe('opsx-dev-pipeline');
    expect(typeof parsed._opsxManaged.templateVersion).toBe('string');
  });

  it('renders valid JSON for Windows user-scope skill paths with spaces', async () => {
    // user-scope skillsDir comes from path.join(os.homedir(), ...) and carries
    // backslashes on Windows; the rendered JSON must stay parseable and keep the
    // hook script path as a single quoted argument.
    const content = await renderTemplate(
      TEMPLATE,
      context(true, 'C:\\Users\\John Doe\\.claude\\skills'),
    );
    const parsed = JSON.parse(content);
    expect(parsed.hooks.PreToolUse[0].hooks[0].command).toBe(
      'node "C:/Users/John Doe/.claude/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs"',
    );
    expect(parsed.hooks.PreToolUse[1].hooks[0].command).toBe(
      'node "C:/Users/John Doe/.claude/skills/opsx-dev-pipeline/scripts/hooks/block-sensitive-write.mjs"',
    );
  });

  it('renders valid JSON for Windows user-scope skill paths without spaces', async () => {
    const content = await renderTemplate(TEMPLATE, context(true, 'C:\\Users\\jane\\.claude\\skills'));
    const parsed = JSON.parse(content);
    expect(parsed.hooks.PreToolUse[0].hooks[0].command).toBe(
      'node C:/Users/jane/.claude/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs',
    );
  });
});
