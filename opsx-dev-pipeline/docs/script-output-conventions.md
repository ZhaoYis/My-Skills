# opsx 脚本输出约定

本文件用于落实优化方案中的 Step A5：统一关键脚本输出结构。

目标：

- 让关键脚本在成功、失败、需人工确认三类情况下更容易被 skill 和文档统一消费
- 降低脚本之间“有的输出文本、有的输出 JSON、有的只靠 exit code”的不一致
- 在不大幅重构现有脚本的前提下，先建立一套最小可执行约定

## 适用范围

当前优先纳入统一约定的脚本：

- `scripts/opsx-preflight.sh`
- `scripts/opsx-detect-schema.sh`
- `scripts/opsx-change-status.sh`
- `scripts/opsx-change-context.sh`
- `scripts/opsx-resolve-verify.sh`
- `scripts/opsx-validate-change.sh`

## 统一约定

### 1. 输出分类

分三类：

1. **结构化 JSON 输出脚本**
   - stdout 输出单个 JSON 对象
   - 失败时尽量也输出结构化 JSON，再退出非 0
   - 适用于：detect-schema、change-context、resolve-verify

2. **CLI 透传型脚本**
   - 直接透传 openspec CLI 的 JSON 输出
   - 失败以 CLI stderr + exit code 为主
   - 适用于：change-status、validate-change

3. **前置检查型脚本**
   - 成功输出简洁、稳定的机器可读结果
   - 失败输出明确错误原因到 stderr，并返回稳定 exit code
   - 适用于：preflight

### 2. 推荐 JSON 字段

对结构化 JSON 输出脚本，优先包含：

- `status`
  - `ok`
  - `warning`
  - `error`
- `reason`
  - 简短、稳定、便于上层判断的原因码或说明
- `nextAction`
  - 给调用方或用户的推荐下一步

其余字段按脚本职责保留，例如：
- `schema`
- `stacks`
- `contexts`
- `standards`
- `rulesSummary`
- `command`

### 3. 失败输出原则

- **stdout 留给主结果**，尤其是 JSON
- **stderr 留给错误说明**
- 若脚本以 JSON 为主，失败时优先输出 JSON 到 stdout，再退出非 0
- 不混用“部分 JSON + 部分解释性文本”到 stdout

### 4. 最小兼容策略

为了避免一次性改动过大，当前优先做：

- `opsx-preflight.sh`
  - 保留 exit code 语义
  - 将成功输出从 `ok` 扩展为结构化 JSON
- `opsx-detect-schema.sh`
  - 增补 `status` / `reason` / `nextAction`
- `opsx-change-context.sh`
  - 增补 `status` / `reason` / `nextAction`
- `opsx-resolve-verify.sh`
  - 增补 `status` / `reason` / `nextAction`
- `opsx-change-status.sh`
  - 暂保持 openspec 透传，不做包裹
- `opsx-validate-change.sh`
  - 暂保持 openspec 透传，不做包裹

## 当前脚本对应策略

| 脚本 | 类型 | 当前策略 |
|---|---|---|
| `opsx-preflight.sh` | 前置检查型 | 改为 JSON 成功输出，失败保持 stderr + exit code |
| `opsx-detect-schema.sh` | 结构化 JSON 输出脚本 | 保留原字段，新增 `status/reason/nextAction` |
| `opsx-change-status.sh` | CLI 透传型脚本 | 暂不包裹 |
| `opsx-change-context.sh` | 结构化 JSON 输出脚本 | 保留原字段，新增 `status/reason/nextAction` |
| `opsx-resolve-verify.sh` | 结构化 JSON 输出脚本 | 保留原字段，新增 `status/reason/nextAction` |
| `opsx-validate-change.sh` | CLI 透传型脚本 | 暂不包裹 |

## Step A5 验收标准

1. 关键脚本至少完成一轮输出约定收敛
2. 新增字段不破坏现有调用方对旧字段的依赖
3. 成功、失败、需人工确认三类信号更容易区分
4. 文档中已明确哪些脚本已统一、哪些暂保持透传
