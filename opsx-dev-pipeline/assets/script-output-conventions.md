# opsx 脚本输出约定

本文件只保留当前仍有效的脚本输出契约与第一轮逐脚本 I/O 手册。

## 1. 输出分类

### 1.1 结构化 JSON 输出脚本

- stdout 输出单个 JSON 对象
- 失败时优先输出结构化 JSON，再退出非 0
- 适用于：`opsx-detect-schema.sh`、`opsx-change-context.sh`、`opsx-resolve-verify.sh`

### 1.2 CLI 透传型脚本

- 直接透传 openspec CLI 的 JSON 输出
- 失败以 CLI stderr + exit code 为主
- 适用于：`opsx-change-status.sh`、`opsx-validate-change.sh`、`opsx-list-changes.sh`、`opsx-instructions-apply.sh`

### 1.3 前置检查 / 包装型脚本

- 成功输出简洁、稳定的机器可读结果，或直接透传明确结果
- 失败输出明确错误原因到 stderr，并返回稳定 exit code
- 适用于：`opsx-preflight.sh`、`opsx-new-change.sh`、`opsx-instructions.sh`

## 2. 推荐 JSON 字段

对结构化 JSON 输出脚本，优先包含：

- `status`：`ok` / `warning` / `error`
- `reason`：简短、稳定、便于上层判断的原因码或说明
- `nextAction`：给调用方或用户的推荐下一步

其余字段按脚本职责保留，例如：

- `schema`
- `stacks`
- `contexts`
- `standards`
- `rulesSummary`
- `command`

## 3. 失败输出原则

- stdout 留给主结果，尤其是 JSON
- stderr 留给错误说明
- 若脚本以 JSON 为主，失败时优先输出 JSON 到 stdout，再退出非 0
- 不混用“部分 JSON + 部分解释性文本”到 stdout

## 4. 当前脚本策略

| 脚本 | 类型 | 当前策略 |
| --- | --- | --- |
| `opsx-preflight.sh` | 前置检查型 | 成功输出 JSON，失败保持 stderr + exit code |
| `opsx-detect-schema.sh` | 结构化 JSON 输出脚本 | 保留原字段，包含 `status/reason/nextAction` |
| `opsx-change-status.sh` | CLI 透传型脚本 | 暂不包裹 |
| `opsx-change-context.sh` | 结构化 JSON 输出脚本 | 保留原字段，包含 `status/reason/nextAction` |
| `opsx-resolve-verify.sh` | 结构化 JSON 输出脚本 | 保留原字段，包含 `status/reason/nextAction` |
| `opsx-validate-change.sh` | CLI 透传型脚本 | 暂不包裹 |
| `opsx-list-changes.sh` | CLI 透传型脚本 | 透传 `openspec list --json` |
| `opsx-new-change.sh` | 包装型脚本 | 透传 `openspec new change` |
| `opsx-instructions.sh` | 包装型脚本 | 透传 `openspec instructions --json`，省略 artifact 时先本地推断 |
| `opsx-instructions-apply.sh` | CLI 透传型脚本 | 透传 `openspec instructions apply --json` |

## 5. 逐脚本 I/O 手册

当前手册先覆盖 4 个高频入口脚本；其余脚本按上文“当前脚本策略”维护，后续继续补齐。

### `opsx-list-changes.sh`

- **作用 / 所属 Phase**：列出当前仓库的 change 列表；用于 Phase 0 / 1 的候选展示
- **调用方式与参数**：`bash scripts/opsx-list-changes.sh [openspec list 额外参数...]`
- **输入前提**：当前目录可执行 `openspec list`
- **stdout 契约**：直接透传 `openspec list --json` 的 stdout JSON
- **stderr 契约**：失败时以 openspec CLI stderr 为主
- **exit code 语义**：完全透传 openspec CLI exit code
- **透传 / 包装类型**：CLI 透传型
- **关键示例**：`bash scripts/opsx-list-changes.sh`、`bash scripts/opsx-list-changes.sh --sort name`
- **调用方注意事项**：不要假设脚本额外包裹了 `status/reason` 字段

### `opsx-new-change.sh`

- **作用 / 所属 Phase**：在 Phase 1 创建新 change；不负责后续制品生成
- **调用方式与参数**：`bash scripts/opsx-new-change.sh <change-name> [openspec new change 额外参数...]`
- **输入前提**：必须传入 `<change-name>`
- **stdout 契约**：成功时直接透传 `openspec new change` 的标准输出
- **stderr 契约**：缺参时报参数错误；其余失败以 openspec CLI stderr 为主
- **exit code 语义**：缺参时直接退出；正常执行时透传 openspec CLI exit code
- **透传 / 包装类型**：包装型脚本
- **关键示例**：`bash scripts/opsx-new-change.sh my-change`
- **调用方注意事项**：创建 change 不等于完成 Phase 1，后续通常要继续生成制品或补元数据

### `opsx-instructions.sh`

- **作用 / 所属 Phase**：在 Phase 1 获取某个 artifact 的 instructions；省略 artifact 时自动选择第一个 `ready` 制品
- **调用方式与参数**：`bash scripts/opsx-instructions.sh <change-name> [artifact-id]`
- **输入前提**：必须传入 `<change-name>`；省略 `artifact-id` 时需要本机可用 `python3`
- **stdout 契约**：成功时透传 `openspec instructions <artifact> --change <change> --json` 的 stdout JSON
- **stderr 契约**：缺少 `python3`、没有 `ready` 制品或 openspec CLI 失败时输出错误信息
- **exit code 语义**：缺参、缺少 `python3`、无 `ready` 制品或解析失败时退出非 0；其余透传 openspec CLI
- **透传 / 包装类型**：包装型脚本；仅在自动选 artifact 时增加本地推断逻辑
- **关键示例**：`bash scripts/opsx-instructions.sh my-change`、`bash scripts/opsx-instructions.sh my-change proposal`
- **调用方注意事项**：若希望稳定控制制品，应显式传入 `artifact-id`；apply 场景应使用 `opsx-instructions-apply.sh`

### `opsx-instructions-apply.sh`

- **作用 / 所属 Phase**：在 Phase 2 获取 apply 上下文；等价于 `openspec instructions apply --change --json`
- **调用方式与参数**：`bash scripts/opsx-instructions-apply.sh <change-name>`
- **输入前提**：必须传入 `<change-name>`
- **stdout 契约**：成功时直接透传 `openspec instructions apply --change <change> --json` 的 stdout JSON
- **stderr 契约**：失败时以 openspec CLI stderr 为主
- **exit code 语义**：缺参时直接退出；其余透传 openspec CLI exit code
- **透传 / 包装类型**：CLI 透传型
- **关键示例**：`bash scripts/opsx-instructions-apply.sh my-change`
- **调用方注意事项**：重点关注 JSON 中的 `state` 字段；`blocked` 应回到 Phase 1，`all_done` 可直接进入后续 review 路径
