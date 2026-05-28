---
name: schema-adapter
description: 定义默认 OpenSpec schema 与自定义 schema 的适配差异、上下文来源、verify 解析与降级策略。
---

## 1. 目标

本附录用于说明 `opsx-dev-pipeline` 如何在**保持主流程不变**的前提下，适配不同 OpenSpec schema。

当前支持两类路径：

- **默认 schema**：沿用 OpenSpec 默认 artifact / apply / archive 行为
- **特定 schema**：启用自定义上下文、schema-defined artifacts、verify-before-archive 增强规则

## 2. 适配原则

- **Phase 0–6、决策点、Review、Fix-CR、Unit Test、Commit / Push / Merge** 仍由本 skill 控制
- **artifact 集合、stack 元数据、apply context、verify 命令映射** 优先由 `openspec/config.yaml` 与 change 下 `.openspec.yaml` 驱动
- **AGENTS.md / CLAUDE.md** 仅作为补充协作规范来源，且不得覆盖 `openspec/config.yaml` 中已明确的项目事实与流程约束

## 3. 差异矩阵


| 能力               | 默认 schema                                        | 特定 schema                            |
| ---------------- | ------------------------------------------------ | ------------------------------------ |
| schema 识别        | 无显式 schema 或非特定 schema                           | `openspec/config.yaml` 中声明的特定 schema |
| 预期 artifacts     | 以 OpenSpec 默认 status / instructions 为准           | 根据具体 schema 定义的 artifacts            |
| change 元数据       | 无强制 `.openspec.yaml`                             | 根据具体 schema 要求声明元数据                  |
| apply 上下文        | `openspec instructions apply` 返回的 `contextFiles` | 根据具体 schema 和元数据扩展 context           |
| review 基准        | `config.yaml -> AGENTS.md -> CLAUDE.md`          | 上述基准 + schema 定义的标准                  |
| archive 前 verify | 无统一前置门禁                                          | 根据具体 schema 要求执行 verify              |
| Phase 5 测试推荐     | 仓库构建文件启发式优先                                      | 根据具体 schema 优先，其次仓库启发式               |


## 4. 通用适配规则

### 4.1 schema 处理

对于任意特定 schema（非 spec-driven 默认情况）：

1. 检测 `openspec/config.yaml` 中的 `schema` 字段
2. 根据具体 schema 类型加载对应的 artifacts、stacks、context 等配置
3. 执行 schema 对应的特殊逻辑（如 verify 命令等）

### 4.2 元数据处理

根据具体 schema 要求，在 change 目录下的 `.openspec.yaml` 中声明相应的元数据。

若缺失：

- Phase 1 最晚补齐
- 用户无法明确时，可先给出推荐值并征询确认

### 4.3 apply context 合并

对于特定 schema：

1. 读取 `openspec/config.yaml` 中根据 schema 定义的相关配置
2. 读取 change 下 `.openspec.yaml` 中的元数据
3. 合并 context 和 rules
4. 将标准与其他规范路径一同提供给各阶段

## 5. 适配层输出

建议通过脚本统一输出以下能力：

- 当前 `schema`
- 当前 change 的元数据（根据 schema 类型）
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

### 6.3 特定 schema 但缺失元数据文件

- 在 Phase 1 创建必要的元数据文件
- 由用户确认相关的配置项
- 若用户暂不能确认，可暂停或以推荐值临时写入后继续

## 7. 与 Phase 的关系

- **Phase 0**：识别 schema / stacks 能力
- **Phase 1**：补齐 `.openspec.yaml` 与 `stacks`，按 schema 展示 artifacts
- **Phase 2**：使用 merged context / rules
- **Phase 3**：使用 stack-aware review baseline
- **Phase 4**：执行 verify-before-archive
- **Phase 5**：schema-aware 测试命令推荐

