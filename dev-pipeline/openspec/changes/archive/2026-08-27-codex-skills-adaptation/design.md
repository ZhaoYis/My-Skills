## Context

当前 dev-pipeline 的工具注册表（`tools.json`）为每个工具定义了 `destinations`（root/skills/commands），所有资产（skills、commands、docs）共享同一套路径。Codex 当前配置为 `.codex/prompts` 和 `.codex/commands`，但 Codex 只支持 skills 模式。

现有架构中，command 模板（`.hbs`）的 frontmatter 是固定的 slash-command 格式，所有工具共享同一模板。要为 Codex 生成 skill 格式的 frontmatter，需要在模板中引入工具条件判断。

## Goals / Non-Goals

**Goals:**
- Codex 安装产物全部位于 `.agents/skills/` 下，每个可调用单元都是一个 skill 文件夹
- 通过 `toolDestinations` 机制实现按工具覆盖目标路径，避免为 Codex 硬编码特殊逻辑
- Command 模板通过 Handlebars 条件适配 frontmatter 格式，保持正文内容不变
- Claude 和 Cursor 的安装行为零改动

**Non-Goals:**
- 不处理 `openspec-propose` 等外部 skill 引用缺失问题（记录为 TODO）
- 不实现 `.codex/` → `.agents/` 的自动迁移
- 不新增 codex 专属的 overlay 模板目录（所有适配在共享模板内完成）
- 不修改 `ToolAdapter` 接口或 `StaticToolAdapter` 类的结构

## Decisions

### 1. 路径覆盖机制：`toolDestinations` 字段

**决策**: 在 `AssetDefinition` 中新增 `toolDestinations?: Partial<Record<ToolId, string>>` 字段，`buildInstallPlan` 解析 destination 时优先查 `toolDestinations[toolId]`。

**理由**:
- 通用机制，未来其他工具也可能需要路径覆盖
- 不改变现有 `destination` 字段的语义，向后兼容
- 声明式配置，不需要在代码中写 `if (toolId === 'codex')` 分支

**替代方案**:
- 在 `buildInstallPlan` 中硬编码 codex 特殊逻辑 → 违反开闭原则，每加一个工具都要改代码
- 为 codex 创建独立的 manifest → 维护成本高，大量重复定义

### 2. Frontmatter 适配：Handlebars 条件

**决策**: 在现有 command 模板中用 `{{#if (eq toolId "codex")}}...{{else}}...{{/if}}` 切换 frontmatter 格式。

**理由**:
- Command 的正文内容（prompt body）对所有工具相同，只有 frontmatter 不同
- `toolId` 已在 `buildTemplateContext` 中传入，无需新增上下文变量
- 避免为 codex 创建 9 个重复的模板文件

**替代方案**:
- 为 codex 创建独立的模板文件（`src/templates/tools/codex/overlay/commands/...`）→ 文件数量翻倍，正文内容重复
- 在 `buildInstallPlan` 中后处理 frontmatter → 逻辑分散，难以维护

### 3. Command 到 Skill 的转换方式：目标路径覆盖

**决策**: 每个 command 资产通过 `toolDestinations.codex` 指定目标为 `{{commandsDir}}/<skill-name>/SKILL.md`。由于 `commandsDir` 在 codex 下等于 `skillsDir`（都是 `.agents/skills`），最终路径为 `.agents/skills/<skill-name>/SKILL.md`。

**理由**:
- 复用现有的 command 资产和模板，不需要新建资产类型
- `commandsDir` 的值由 `tools.json` 控制，codex 的 `destinations.commands` 设为 `.agents/skills` 即可
- 每个 command 的 `toolDestinations.codex` 只需改文件名（`propose.md` → `opsx-propose/SKILL.md`）

**替代方案**:
- 新建 `skill-from-command` 资产类型 → 过度设计，只是路径和 frontmatter 不同
- 在 manifest 中为 codex 单独定义 9 个新资产 → 重复定义 source 和 writePolicy

### 4. 删除 codex-docs 和 codex-command-guide

**决策**: 直接从 manifest 中移除这两个资产定义。

**理由**:
- `codex-docs` 的内容（`opsx-dev-pipeline.mdc.hbs`）是 Cursor rule 格式，对 codex 无意义
- `codex-command-guide` 是 commands 目录的 README，commands 目录不存在后它也无意义
- `opsx-dev-pipeline` skill bundle 本身已包含完整文档

### 5. Markers 变更

**决策**: `markers` 从 `[".codex"]` 改为 `[".agents"]`。

**理由**:
- `.agents/` 是 codex 的新安装根目录
- 检测 `.agents/` 存在即可推断 codex 工具

**风险**: `.agents/` 可能被其他工具使用。当前场景下可接受，后续如需更精确检测可加入 `.agents/skills/` 作为二级标记。

## Risks / Trade-offs

**风险 1**: 已安装到 `.codex/` 的项目不会自动迁移
- **缓解**: 这是 BREAKING 变更，在 release notes 中明确说明
- **缓解**: 用户可手动删除 `.codex/` 并重新运行 `init`

**风险 2**: `.agents/` 标记可能被其他工具占用
- **缓解**: 当前 codex 是唯一使用 `.agents/` 的工具
- **缓解**: 未来可加入更精确的二级标记

**风险 3**: Handlebars 条件增加模板复杂度
- **缓解**: 只有 frontmatter 部分有条件，正文不变
- **缓解**: 条件逻辑简单（`eq toolId "codex"`），易于理解

**权衡**: 通用性 vs 简洁性
- `toolDestinations` 是通用机制，增加了系统灵活性
- 当前只有 codex 需要，但机制本身不复杂

## Migration Plan

### 部署步骤

1. 修改 `src/config/tools.json` 中 codex 的配置
2. 修改 `src/core/assets/types.ts` 增加 `toolDestinations` 字段
3. 修改 `src/core/assets/manifest.ts`：
   - 为每个 command 资产添加 `toolDestinations.codex`
   - 删除 `codex-docs` 和 `codex-command-guide`
4. 修改 `src/core/init/buildInstallPlan.ts`：destination 解析支持 `toolDestinations` 覆盖
5. 修改 `src/templates/common/commands/*.hbs`：frontmatter 加 Handlebars 条件
6. 更新测试用例
7. 运行 `npm test` 确保所有测试通过
8. 发布新版本（minor 版本，因为有 BREAKING 变更）

### 回滚策略

- 回滚到旧版本即可
- 已安装到 `.agents/` 的项目需手动删除并重新安装到 `.codex/`

### 用户迁移

- 现有 `.codex/` 项目：手动删除后重新 `init`
- 新安装：直接使用 `.agents/skills/`
