import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import { describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

describe('Phase 0 Template Route Evaluation', () => {
  it('includes route evaluation section in template', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Verify route evaluation section exists
    expect(templateContent).toContain('## Step2.5：Route 评估');
    expect(templateContent).toContain(
      '在确定入口类型后、进入具体 Phase 前，必须评估变更的风险等级并选择合适的 route',
    );
  });

  it('includes route evaluation criteria table', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Verify evaluation criteria table exists
    expect(templateContent).toContain('| Route | 适用场景 | 关键条件 |');
    expect(templateContent).toContain('| `trivial` | typo、格式化、注释、import 清理 |');
    expect(templateContent).toContain('| `standard` | 功能开发、Bug 修复、重构 |');
    expect(templateContent).toContain('| `full` | 核心业务逻辑、数据库迁移、安全相关 |');
  });

  it('includes route decision flow with askTool', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Verify decision flow exists
    expect(templateContent).toContain('### 决策流程');
    expect(templateContent).toContain('使用 **{{askTool}}** 让用户确认 route 选择');
    expect(templateContent).toContain('**header**：`Route 选择`');
    expect(templateContent).toContain(
      '**question**：`根据需求分析，推荐使用 <recommended-route> route',
    );
  });

  it('includes route selection recording command', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Verify route selection recording command exists
    expect(templateContent).toContain(
      'node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" route_choice "<route>"',
    );
  });

  it('includes skip conditions for existing changes', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Verify skip conditions exist
    expect(templateContent).toContain('### 跳过条件');
    expect(templateContent).toContain(
      '如果状态文件中已存在 `route.choice` 字段（续接已有 change），跳过 Route 评估',
    );
  });

  it('includes phase execution matrix for each route', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Verify phase execution matrix exists
    expect(templateContent).toContain(
      '如果用户选择 `trivial` route，后续流程将跳过 Phase 1（提案）、Phase 3（审查）、Phase 4（单测）、Phase 5（归档）、Phase 7（合并）',
    );
    expect(templateContent).toContain(
      '如果用户选择 `standard` route，后续流程将跳过 Phase 3（审查）、Phase 4（单测）、Phase 7（合并）',
    );
    expect(templateContent).toContain('如果用户选择 `full` route，执行完整 Phase 0-7 流程');
  });

  it('template renders without errors', () => {
    const templatePath = join(
      PACKAGE_ROOT,
      'src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs',
    );
    const templateContent = readFileSync(templatePath, 'utf-8');

    // Register askTool helper (mock)
    Handlebars.registerHelper('askTool', () => 'askTool');

    // Compile and render template
    const template = Handlebars.compile(templateContent);
    const rendered = template({});

    // Verify template renders successfully
    expect(rendered).toBeTruthy();
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toContain('# Phase0: 入口判断');
    expect(rendered).toContain('## Step2.5：Route 评估');
  });
});
