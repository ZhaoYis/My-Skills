import { describe, expect, it } from 'vitest';
import { buildTemplateContext } from '../../../src/core/init/buildInstallPlan.js';
import { renderTemplate } from '../../../src/core/init/renderTemplates.js';
import path from 'node:path';

const TEMPLATE = path.resolve(
  process.cwd(),
  'src/templates/tools/opencode/opencode.json.hbs',
);

function context(hooksEnabled = true) {
  return buildTemplateContext({
    projectName: 'demo',
    toolId: 'opencode',
    toolName: 'OpenCode',
    stack: 'frontend',
    language: 'zh',
    features: ['base', 'skills', 'commands', 'docs', 'schema', 'hooks'],
    skillsDir: '.opencode/skills',
    commandsDir: '.opencode/commands',
    hooksEnabled,
  });
}

describe('opencode.json.hbs', () => {
  it('renders valid JSON when hooksEnabled', async () => {
    const content = await renderTemplate(TEMPLATE, context(true));
    const parsed = JSON.parse(content);
    expect(parsed._opsxManaged.hooksEnabled).toBe(true);
    expect(parsed.hooks.PreToolUse).toHaveLength(2);
  });

  it('uses lowercase `bash` matcher (OpenCode convention)', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    const bashEntry = parsed.hooks.PreToolUse.find(
      (e: { matcher: string }) => e.matcher === 'bash',
    );
    expect(bashEntry).toBeDefined();
    expect(bashEntry.hooks[0].command).toMatch(/block-dangerous-bash\.mjs$/);
  });

  it('uses `write|edit|multi_edit` matcher (lowercase, pipe-separated)', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    const writeEntry = parsed.hooks.PreToolUse.find(
      (e: { matcher: string }) => e.matcher === 'write|edit|multi_edit',
    );
    expect(writeEntry).toBeDefined();
    expect(writeEntry.hooks[0].command).toMatch(/block-sensitive-write\.mjs$/);
  });

  it('uses numeric timeout (5000ms) per OpenCode convention', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    expect(parsed.hooks.PreToolUse[0].hooks[0].timeout).toBe(5000);
    expect(parsed.hooks.PreToolUse[1].hooks[0].timeout).toBe(5000);
  });

  it('embeds {{skillsDir}}-based relative paths', async () => {
    const parsed = JSON.parse(await renderTemplate(TEMPLATE, context(true)));
    expect(parsed.hooks.PreToolUse[0].hooks[0].command).toContain(
      '.opencode/skills/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs',
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
});
