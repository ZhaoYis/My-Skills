import { MANIFEST_FILE } from '../runtime/meta.js';
import type { AssetDefinition } from './types.js';

export const assetManifest: AssetDefinition[] = [
  {
    id: 'common-readme',
    kind: 'template',
    scope: 'common',
    feature: 'base',
    source: 'templates/common/base/README.md.hbs',
    destination: 'README.md'
  },
  {
    id: 'common-gitignore',
    kind: 'static',
    scope: 'common',
    feature: 'base',
    source: 'templates/common/base/gitignore',
    destination: '.gitignore'
  },
  {
    id: 'common-metadata',
    kind: 'template',
    scope: 'common',
    feature: 'base',
    source: 'templates/common/base/opsx-dev-pipeline.json.hbs',
    destination: MANIFEST_FILE
  },
  {
    id: 'dev-pipeline-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/dev-pipeline',
    destination: '{{skillsDir}}/dev-pipeline',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'dev-pipeline-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/dev-pipeline.md.hbs',
    destination: '{{commandsDir}}/dev-pipeline.md'
  },
  {
    id: 'common-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/review.md.hbs',
    destination: '{{commandsDir}}/review.md'
  },
  {
    id: 'claude-docs',
    kind: 'template',
    scope: 'tool',
    feature: 'docs',
    tools: ['claude'],
    source: 'templates/tools/claude/overlay/CLAUDE.md.hbs',
    destination: 'CLAUDE.md'
  },
  {
    id: 'cursor-docs',
    kind: 'template',
    scope: 'tool',
    feature: 'docs',
    tools: ['cursor'],
    source: 'templates/tools/cursor/overlay/.cursor/rules/opsx-dev-pipeline.mdc.hbs',
    destination: '.cursor/rules/opsx-dev-pipeline.mdc'
  },
  {
    id: 'cursor-command-guide',
    kind: 'template',
    scope: 'tool',
    feature: 'commands',
    tools: ['cursor'],
    source: 'templates/tools/cursor/overlay/.cursor/commands/README.md.hbs',
    destination: '.cursor/commands/README.md'
  },
  {
    id: 'codex-docs',
    kind: 'template',
    scope: 'tool',
    feature: 'docs',
    tools: ['codex'],
    source: 'templates/tools/codex/overlay/.codex/prompts/opsx-dev-pipeline.md.hbs',
    destination: '.codex/prompts/opsx-dev-pipeline.md'
  },
  {
    id: 'codex-command-guide',
    kind: 'template',
    scope: 'tool',
    feature: 'commands',
    tools: ['codex'],
    source: 'templates/tools/codex/overlay/.codex/commands/README.md.hbs',
    destination: '.codex/commands/README.md'
  },
  {
    id: 'generic-docs',
    kind: 'template',
    scope: 'tool',
    feature: 'docs',
    tools: ['generic'],
    source: 'templates/tools/generic/overlay/.ai/README.md.hbs',
    destination: '.ai/README.md'
  }
];
