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
    id: 'common-knowledge-skeleton',
    kind: 'bundle',
    scope: 'common',
    feature: 'base',
    source: 'templates/common/knowledge',
    destination: '.knowledge',
    includeExtensions: ['.md', '.hbs'],
    adoptOnUpgrade: true
  },
  {
    id: 'opsx-dev-pipeline-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-dev-pipeline',
    destination: '{{skillsDir}}/opsx-dev-pipeline',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep'],
    bundleGatedFiles: [
      { path: 'assets/structural-analysis-hint.md', feature: 'structural-analysis-hint' }
    ]
  },
  {
    id: 'opsx-dev-pipeline-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-dev-pipeline.md.hbs',
    destination: '{{commandsDir}}/opsx-dev-pipeline.md'
  },
  {
    id: 'opsx-learn-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-learn',
    destination: '{{skillsDir}}/opsx-learn',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-learn-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-learn.md.hbs',
    destination: '{{commandsDir}}/opsx-learn.md'
  },
  {
    id: 'opsx-analysis-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-analysis',
    destination: '{{skillsDir}}/opsx-analysis',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-analysis-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-analysis.md.hbs',
    destination: '{{commandsDir}}/opsx-analysis.md'
  },
  {
    id: 'opsx-design-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-design',
    destination: '{{skillsDir}}/opsx-design',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-design-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-design.md.hbs',
    destination: '{{commandsDir}}/opsx-design.md'
  },
  {
    id: 'opsx-verify-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-verify',
    destination: '{{skillsDir}}/opsx-verify',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-verify-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-verify.md.hbs',
    destination: '{{commandsDir}}/opsx-verify.md'
  },
  {
    id: 'opsx-clarify-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-clarify',
    destination: '{{skillsDir}}/opsx-clarify',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-clarify-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-clarify.md.hbs',
    destination: '{{commandsDir}}/opsx-clarify.md'
  },
  {
    id: 'opsx-health-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/opsx-health',
    destination: '{{skillsDir}}/opsx-health',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-health-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/opsx-health.md.hbs',
    destination: '{{commandsDir}}/opsx-health.md'
  },
  {
    id: 'opsx-prototype-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'prototype',
    source: 'templates/common/skills/opsx-prototype',
    destination: '{{skillsDir}}/opsx-prototype',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'opsx-prototype-command',
    kind: 'template',
    scope: 'common',
    feature: 'prototype',
    source: 'templates/common/commands/opsx-prototype.md.hbs',
    destination: '{{commandsDir}}/opsx-prototype.md'
  },
  {
    id: 'git-commit-push-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/git-commit-push',
    destination: '{{skillsDir}}/git-commit-push',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'git-code-review-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/git-code-review',
    destination: '{{skillsDir}}/git-code-review',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'git-merge-branch-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/git-merge-branch',
    destination: '{{skillsDir}}/git-merge-branch',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'file-code-review-skill-bundle',
    kind: 'bundle',
    scope: 'common',
    feature: 'skills',
    source: 'templates/common/skills/file-code-review',
    destination: '{{skillsDir}}/file-code-review',
    includeExtensions: ['.md', '.hbs', '.sh'],
    templateFiles: ['SKILL.md.hbs'],
    excludePatterns: ['.gitkeep']
  },
  {
    id: 'git-commit-push-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/git-commit-push.md.hbs',
    destination: '{{commandsDir}}/git-commit-push.md'
  },
  {
    id: 'git-code-review-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/git-code-review.md.hbs',
    destination: '{{commandsDir}}/git-code-review.md'
  },
  {
    id: 'git-merge-branch-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/git-merge-branch.md.hbs',
    destination: '{{commandsDir}}/git-merge-branch.md'
  },
  {
    id: 'file-code-review-command',
    kind: 'template',
    scope: 'common',
    feature: 'commands',
    source: 'templates/common/commands/file-code-review.md.hbs',
    destination: '{{commandsDir}}/file-code-review.md'
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
