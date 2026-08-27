## Context

当前项目使用 OpenSpec spec-driven 工作流，在 backend 和 fullstack 栈的 schema 中定义了 proposal、api-design、specs、design、tasks 等 artifact。用户请求在 backend 和 fullstack 栈中新增 ADR 模板支持。

现有的 schema 模板结构：
- `src/templates/common/schemas/{stack}/schema.yaml.hbs` — 定义 artifact 列表和依赖关系
- `src/templates/common/schemas/{stack}/templates/*.md.hbs` — 各 artifact 的模板文件

ADR 模板应作为 conditional artifact 存在，用户选择是否生成，这与现有的 `design.md` 的 conditional 逻辑类似。

## Goals / Non-Goals

**Goals:**
- 在 backend 和 fullstack 的 templates 目录中新增 `adr.md.hbs` 模板文件
- 在对应的 `schema.yaml.hbs` 中添加 `adr` artifact 定义，标记为 conditional

**Non-Goals:**
- 不修改前端（frontend）栈的 schema
- 不修改 CLI 接口或安装流程
- 不改变现有 artifact 的依赖关系
- 不引入新的 npm 依赖

## Decisions

### 1. ADR 模板位置
**决策**: 在 `src/templates/common/schemas/{stack}/templates/adr.md.hbs` 放置模板文件。

**理由**: 与现有的 `design.md.hbs`、`proposal.md.hbs` 等模板保持一致的组织方式。每个栈的 templates 目录独立管理其模板文件。

**替代方案**: 放在 `src/templates/common/` 下作为共享模板 — 但 backend 和 fullstack 的 ADR 模板可能有细微差异（如 fullstack 需要同时考虑前后端架构决策），分栈独立放置更灵活。

### 2. ADR artifact 定义方式
**决策**: 在 `schema.yaml.hbs` 的 `artifacts` 列表中新增 `adr` artifact，instruction 中标记为 conditional（用户选择是否生成）。

**理由**: 与 `design.md` 的 conditional 逻辑一致 — `design.md` 在 instruction 中写明 "create only if any apply"，用户会根据实际情况决定是否生成。ADR 同样采用此模式。

**替代方案**: 通过 `bundleGatedFiles` 控制 — 但 ADR 不是 bundle 的一部分，而是独立的 artifact，直接用 artifact 定义更合适。

### 3. ADR 模板结构
**决策**: 采用 Michael Nygard 的经典 ADR 格式，包含 Title、Status、Context、Decision、Consequences 章节，并增加 Alternatives Considered 章节。

**理由**: 这是业界最广泛采用的 ADR 格式，简洁且信息完整。Alternatives Considered 帮助记录决策的权衡过程。

### 4. 仅 backend 和 fullstack 包含 ADR
**决策**: frontend 栈不包含 ADR 模板。

**理由**: 用户需求明确指定"后端或者全栈技术栈模式"。前端项目通常架构决策较少，且集中在组件选型和状态管理，不需要专门的 ADR 文档。

## Risks / Trade-offs

- [Risk] ADR 模板与 design.md 有内容重叠 → 在 ADR 模板的引导文字中说明 ADR 侧重记录"决策及其理由"，design.md 侧重"实现方案"，两者互补
- [Risk] 用户可能不确定何时使用 ADR → 模板中包含简短的适用场景说明

## Migration Plan

无需迁移。这是纯新增功能，通过 `opsx sync` 或重新 `init` 即可获取新模板。

## Open Questions

<!-- None -->