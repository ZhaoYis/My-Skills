---
name: schema-adapter
description: 定义默认 OpenSpec schema 与 yzw-workflow 的适配差异、上下文来源、verify 解析与降级策略。
---

## 1. 目标

本附录用于说明 `opsx-dev-pipeline` 如何在**保持主流程不变**的前提下，适配不同 OpenSpec schema。

当前支持两类路径：

- **默认 schema**：沿用 OpenSpec 默认 artifact / apply / archive 行为
- **`yzw-workflow`**：启用 stack-aware 上下文、schema-defined artifacts、verify-before-archive 增强规则

## 2. 适配原则

- **Phase 0–6、决策点、Review、Fix-CR、Unit Test、Commit / Push / Merge** 仍由本 skill 控制
- **artifact 集合、stack 元数据、apply context、verify 命令映射** 优先由 `openspec/config.yaml` 与 change 下 `.openspec.yaml` 驱动
- **AGENTS.md / CLAUDE.md** 仅作为补充协作规范来源，且不得覆盖 `openspec/config.yaml` 中已明确的项目事实与流程约束

## 3. 差异矩阵

| 能力 | 默认 schema | `yzw-workflow` |
|------|-------------|----------------|
| schema 识别 | 无显式 schema 或非 `yzw-workflow` | `openspec/config.yaml` 中 `schema: yzw-workflow` |
| 预期 artifacts | 以 OpenSpec 默认 status / instructions 为准 | `proposal / adr / specs / design / tasks` |
| change 元数据 | 无强制 `.openspec.yaml` | `.openspec.yaml` 应声明 `stacks` |
| apply 上下文 | `openspec instructions apply` 返回的 `contextFiles` | `contextFiles` + `shared` + 选中 `stacks` 的 context/rules |
| review 基准 | `config.yaml -> AGENTS.md -> CLAUDE.md` | 上述基准 + shared/stack context + standards |
| archive 前 verify | 无统一前置门禁 | 必须先解析并执行 verify，成功后才归档 |
| Phase 5 测试推荐 | 仓库构建文件启发式优先 | schema/stacks 优先，其次仓库启发式 |

## 4. `yzw-workflow` 适配规则

### 4.1 artifact 集合

以 schema 定义为准：

- `proposal`
- `adr`
- `specs`
- `design`
- `tasks`

其中：

- `tasks` 依赖 `specs` 与 `design`
- Phase 1 展示与门禁按该集合执行，不再写死为固定四件套

### 4.2 stacks 元数据

change 目录下 `.openspec.yaml` 期望包含：

```yaml
stacks: [backend]
```

或：

```yaml
stacks: [frontend]
```

或：

```yaml
stacks: [backend, frontend]
```

若缺失：

- Phase 1 最晚补齐
- 用户无法明确时，可先给出推荐值并征询确认

### 4.3 apply context 合并

对 `yzw-workflow`：

1. 读取 `openspec/config.yaml` 中：
   - `shared.context`
   - `backend.context`
   - `frontend.context`
2. 读取 change 下 `.openspec.yaml` 中 `stacks`
3. 合并 context：
   - `shared.context` + 各选中 stack 的 context
4. 合并 rules：
   - 同 artifact ID 的 rules 按 `shared -> stacks` 顺序追加
5. 将 standards 与 `AGENTS.md` / `CLAUDE.md` 等路径一并提供给 Apply / Review / Test 阶段；若内容冲突，以 `openspec/config.yaml` 与 schema 规则为准

### 4.4 verify 命令解析

默认映射：

- `backend` -> `./scripts/validate.sh backend`
- `frontend` -> `./scripts/validate.sh frontend`
- `backend + frontend` -> `make validate`，若不存在则回退 `./scripts/validate.sh all`

若仓库已有更明确约定，以仓库实际脚本为准。

## 5. 适配层输出

建议通过脚本统一输出以下能力：

- 当前 `schema`
- 当前 change 的 `stacks`
- 当前 change 的 expected artifacts
- merged context / rules / standards
- verify command

推荐脚本：

- `scripts/opsx-detect-schema.sh`
- `scripts/opsx-ensure-change-meta.sh`
- `scripts/opsx-change-context.sh`
- `scripts/opsx-resolve-verify.sh`

## 6. 降级策略

### 6.1 无 `openspec/config.yaml`

- 视为默认 schema 路径
- 若存在 `AGENTS.md`：优先沿用其通用 agent 协作规范
- 若不存在 `AGENTS.md` 但存在 `CLAUDE.md`：继续沿用 `CLAUDE.md`
- 若三者均不存在：回退为读取仓库现有代码、测试与构建文件做启发式命令推导

### 6.2 schema 无法识别

- 记录警告
- 视为默认 schema
- 不阻断主流程

### 6.3 `yzw-workflow` 但缺失 `.openspec.yaml`

- 在 Phase 1 创建 `.openspec.yaml`
- 由用户确认 `stacks`
- 若用户暂不能确认，可暂停或以推荐值临时写入后继续

### 6.4 无法解析 verify 命令

- 先查 `make validate`
- 再查 `./scripts/validate.sh all`
- 再降级为提示用户手动确认命令
- 在未确认前，不自动宣称满足 verify-before-archive 门禁

## 7. 与 Phase 的关系

- **Phase 0**：识别 schema / stacks 能力
- **Phase 1**：补齐 `.openspec.yaml` 与 `stacks`，按 schema 展示 artifacts
- **Phase 2**：使用 merged context / rules
- **Phase 3**：使用 stack-aware review baseline
- **Phase 4**：执行 verify-before-archive
- **Phase 5**：schema-aware 测试命令推荐
