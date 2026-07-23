---
name: opsx-dev-pipeline
description: OpenSpec + Git 需求开发全流程。
license: MIT
compatibility: 需安装 openspec 与 git CLI。
metadata:
  author: zhaoyi
  version: "2.3"
---

# 需求开发全流程流水线

**所有输出使用中文。**

## Input

用户的需求描述，或一个已有的 change 名称。

## 执行约束

- 用户补充需求、提案修改或实施说明后，必须在同一回复中同步当前 **Phase / change / 下一动作**，并推进到下一步或决策点。
- 除用户明确选择「终止流程」或「暂停流水线」外，不得单方结束全流程。
- 高风险决策必须显式确认；推荐项不等于自动代选。
- 决策点首选 **AskQuestion** tool；不可用时改用编号选项列表。
- 未经决策点 1 用户明确选择「确认提案，开始实施」，禁止进入 Phase 2。
- 代码审查修复循环最多 3 轮，超过后强制暂停。

## Phase 引用表

| Phase | 说明 | 关键决策点 |
| ----- | ---- | ---------- |
| 0 | 入口判断 | 续接确认 |
| 1 | 提案编写 (Propose) | 决策点 1c（需求理解确认）、决策点 1（提案门禁） |
| 2 | 提案应用 (Apply) | 决策点 2（实施完成确认） |
| 3 | 代码审查 (Review) | 决策点 3（审查结果处理） |
| 4 | 提案归档 (Archive) | 决策点 4（归档后操作） |
| 5 | 单元测试门禁 | 决策点 4b（是否需要单测） |
| 6 | 提交合并推送 | 决策点 5（提交确认）、决策点 6（合并分支） |

**`<SKILL_ROOT>`**：本技能安装根目录（内含 `scripts/`）。下文命令中的占位符须替换为实际绝对路径，命令在目标 git 仓库根目录执行。

---

## Phase 0: 入口判断

### 步骤 1：环境预检

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-preflight.sh
```

- openspec CLI 不可用 → 提示安装并退出
- 不在 git 仓库中 → 提示 `git init` 或进入正确仓库后退出

### 步骤 2：判断入口类型

#### 2.a 用户提供了已有 change 名称

1. 运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"` 检查状态
   - change 不存在 → 运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-list-changes.sh` 展示可用 change，让用户重新选择
2. 按以下优先级判断续接阶段（优先回到最早未完成阶段）：
   - 制品未完成 → 推荐从 Phase 1 继续
   - 制品完成但任务未完成 → 推荐从 Phase 2 继续
   - 任务完成且无审查报告 → 推荐从 Phase 3 继续
   - 已有审查报告但未归档 → 推荐从 Phase 5 开始（完成后进入 Phase 4）
   - 已归档且有未提交变更 → 推荐从 Phase 6 步骤 17 开始
   - 已归档且有未推送提交 → 推荐从 Phase 6 步骤 19 开始
3. 使用 **AskQuestion** 确认：`从 Phase X 继续` / `从头开始（新建 change）` / `终止流程`

#### 2.b 用户提供了需求描述

- 从描述推导 kebab-case 的 change 名称
- 进入 **Phase 1 步骤 2.9（决策点 1c）**

#### 2.c 用户未提供任何输入

- 发送文本消息询问需求描述或 change 名称，等待回复后走 2.a 或 2.b 路径

---

## Phase 1: 提案编写 (Propose)

### 步骤 2.9：[决策点 1c] 需求理解确认（制品生成前）

在生成制品前先确认理解正确。用中性表述给出：影响范围、关键链路、待确认问题。

使用 **AskQuestion**：
- `确认需求理解，开始生成制品（推荐）` → 进入步骤 3
- `补充/修改需求理解` → 文本对话澄清后回到本决策点
- `终止流程` → 退出

### 步骤 3：创建 change 并生成制品

**续接已有 change**：跳过创建，仅对未完成制品执行生成。

**新建 change**：
```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-new-change.sh "<name>"
```
若名称冲突，**AskQuestion**：`在已有 change 上继续` / `创建新名称`。

然后对每个 `ready` 状态的制品：
```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-instructions.sh "<name>" <artifact-id>
```
读取指令后创建文件。使用 **TaskCreate / TaskUpdate** 跟踪进度。

（可选）在决策点 1 前运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-validate-change.sh "<name>"` 做结构校验。

### 步骤 4：[决策点 1] 确认提案（必过门禁）

**硬性规则：用户明确选择「确认提案，开始实施」前，禁止进入 Phase 2。**

展示提案摘要（对照用户原始需求：范围、关键行为、非目标与假设），然后 **AskQuestion**：
- `确认提案，开始实施` → 进入 Phase 2
- `提案不符合预期，我要补充/修改` → 文本对话收集反馈，改制品后回到本决策点
- `终止流程` → 退出

---

## Phase 2: 提案应用 (Apply)

### 步骤 5：获取实施指令

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-instructions-apply.sh "<name>"
```

返回状态处理：
- `state: "blocked"` → **AskQuestion**：`回到 Phase 1 补充制品` / `终止流程`
- `state: "all_done"` → 跳到 Phase 3
- 其他 → 读取 `contextFiles` 继续实施

### 步骤 6：逐任务实施

遍历 `tasks.md`，每个任务动手前执行**写前复用门禁**（在仓库内检索已有相近函数/模块/类型/常量，命中则复用，不造重复轮子）。

每个任务标记完成前执行**准出自审查门禁**：

| # | 自审查项 | 通过判据 |
|---|---------|---------|
| 1 | 正确性 | 实现满足任务描述与提案意图 |
| 2 | 边界与空值 | 处理空/缺省/越界/极端输入 |
| 3 | 错误处理 | 失败路径有明确处理，不吞异常 |
| 4 | 复用与去重 | 已执行写前复用门禁；无重复逻辑 |
| 5 | 命名一致 | 与相邻代码、领域术语一致 |
| 6 | 结构/分层一致 | 与项目既有分层、模块边界一致 |
| 7 | 与项目基准一致 | 符合 `openspec/config.yaml` / `AGENTS.md` / `CLAUDE.md` |
| 8 | 资源与副作用 | 正确释放资源，无泄漏 |
| 9 | 契约/接口一致 | 对外接口、字段、错误语义一致 |
| 10 | 安全与敏感信息 | 无硬编码凭据/密钥 |
| 11 | 可读性 | 关键意图清晰 |
| 12 | 测试随附 | 按项目习惯补充/更新对应测试 |

**有一条不满足 → 不允许标记完成**，先改到满足。

遇到阻塞时 **AskQuestion**：`提供补充说明` / `跳过此任务`（标记 `[~]`） / `终止流程`

### 步骤 7：[决策点 2] 实施完成确认

展示实施摘要，**AskQuestion**：
- `进入代码审查` → Phase 3
- `暂停流水线，手动调整后继续` → 展示恢复指引后退出
- `跳过审查，继续后续流程` → Phase 5（完成后进入 Phase 4）
- `终止流程` → 退出

---

## Phase 3: 代码审查 (Review)

### 步骤 8：加载项目规范

按优先级加载：`openspec/config.yaml` → `AGENTS.md` → `CLAUDE.md`。三者均不存在时警告并回退为读取仓库现有代码做启发式判断。

### 步骤 9：获取变更内容

- 有未提交变更：`git diff HEAD` + `git diff --stat HEAD`
- 无未提交变更：检查未推送提交 `git log origin/<branch>..HEAD --oneline`
- 无任何变更：提示后进入 Phase 5

### 步骤 10：执行代码审查

**敏感信息扫描**：API key、password、token、私钥块等 → 发现记入「严重」。

**审查维度**：
- 正确性：逻辑错误、边界空值、错误处理遗漏
- 安全：注入、XSS、敏感数据明文、鉴权绕过
- 性能：明显 N+1、无分页大批量
- 可维护性：重复逻辑、过大函数、关键行为缺少说明
- 规范对照：以步骤 8 项目基准逐条对照

**报告保存**到 `openspec/review/YYYY-MM-DD-HH-mm-<branch>-pipeline-review.md`，多轮追加 `-round-N`。

### 步骤 11：[决策点 3] 审查结果处理

#### 有严重或重要问题 → AskQuestion：
- `生成修复提案并应用` → 执行 Phase 3.1 子流程后重新审查
- `直接修复并重新审查` → 直接改代码后重新审查
- `暂停流水线，手动调整后继续` → 展示恢复指引后退出
- `继续后续流程` → Phase 5
- `终止流程` → 退出

修复循环最多 3 轮，超过强制暂停。

#### 仅有一般问题或建议 → AskQuestion：
- `继续后续流程` / `生成修复提案并应用` / `暂停流水线` / `终止流程`

#### 审查无问题 → 直接进入 Phase 5

---

## Phase 3.1：「生成修复提案并应用」子流程

**触发**：决策点 3 用户选择「生成修复提案并应用」。必须创建 fix change 并经提案门禁后才允许改业务代码。

1. 根据审查报告确定修复 scope，名称 `fix-cr-<type>`（如 `fix-cr-security`）
2. 新建修复 change 并生成制品（同 Phase 1）
3. **修复提案门禁**：严格按 Phase 1 决策点 1 使用 **AskQuestion**（三选项一致）
4. 逐任务实施修复（同 Phase 2）
5. 归档修复 change：`bash <SKILL_ROOT>/scripts/dev-pipeline-archive.sh "fix-cr-<type>" -y --skip-specs`
6. 回到 Phase 3 步骤 9 重新审查

3 轮后仍有严重问题 → 强制暂停，展示恢复指引后退出。

---

## Phase 4: 提案归档 (Archive)

### 步骤 12：检查制品和任务完成状态

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"
```

若存在未完成任务，**AskQuestion**：`继续归档` / `回到实施阶段` / `终止流程`

### 步骤 13：archive 前 verify 门禁

- 若 `openspec/config.yaml` 或项目约定有 verify 命令，先执行并确保通过
- verify 失败 → **AskQuestion**：`修复后重试` / `暂停流水线` / `终止流程`
- 无法确定 verify 命令 → 请求用户手动确认

### 步骤 14：Delta spec 同步检查

检查 `openspec/changes/<name>/specs/` 下是否有 delta specs。若有，展示变更摘要，**AskQuestion**：
- `同步到主 specs（推荐）` → 步骤 15 使用 `-y`（无 `--skip-specs`）
- `不同步，直接归档` → 步骤 15 使用 `-y --skip-specs`

### 步骤 15：执行归档

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-archive.sh "<name>" -y [--skip-specs]
```

### 步骤 15.5：[决策点 4] 归档后操作

**AskQuestion**：
- `提交代码并合并到目标分支` → Phase 6 完整流程
- `仅提交并推送（不合并）` → Phase 6 commit + push 后结束
- `终止流程` → 退出

---

## Phase 5: 单元测试门禁

### 步骤 16.1：识别测试方式

结合项目基准与构建文件（`package.json`、`pom.xml`、`go.mod` 等）推荐测试命令。若无法唯一确定，列出 2-3 个候选请用户选择。

### 步骤 16.2：[决策点 4b] 是否需要单元测试？

**AskQuestion**（不得默认跳过）：
- `需要：编写/补充单元测试并运行通过后再继续` → 执行子流程 A
- `不需要：跳过单测环节` → 进入 Phase 4 步骤 12
- `暂停流水线，稍后继续` → 展示恢复指引后退出

### 子流程 A

1. 对照审查范围说明拟补充的测试用例
2. 编写或修改单元测试代码（风格与既有用例一致）
3. 执行测试命令
4. 失败 → **AskQuestion**：`修复代码或测试后重试` / `终止流程`
5. 通过 → 进入 Phase 4 步骤 12

---

## Phase 6: 提交合并推送

### 步骤 17：预提交检查

```bash
git status
git branch --show-current
git fetch origin
```

- 分支落后或分叉 → **AskQuestion**：`执行 git pull --rebase` / `继续（不 rebase）` / `终止流程`
- 敏感文件扫描（`.env`、`*.key`、`*.pem` 等）→ 发现则警告并确认

### 步骤 18：暂存并提交

```bash
git add -A
```

- 排除编译产物、IDE 配置等
- 使用 conventional commit 格式（`feat`/`fix`/`perf`/`refactor`/`docs`/`test`/`chore`）

展示提交信息，**[决策点 5] AskQuestion**：
- `确认提交` → 提交
- `修改提交信息` → 文本消息收集后提交
- `终止流程` → 不提交，展示恢复指引

### 步骤 19：推送到远程

```bash
git push origin <current-branch>
```

推送失败 → **AskQuestion**：`执行 pull --rebase 后重试` / `终止流程`

### 步骤 20：[决策点 6] 合并分支（仅当决策点 4 选择「合并」时执行）

列出可用分支，**AskQuestion** 询问目标分支（`master`/`main`/`qa`/`develop`/其他）。

**AskQuestion** 询问合并策略：
- `Standard merge`（推荐）
- `Squash merge`
- `No-ff merge`

执行合并后推送并切回源分支。出现冲突 → **AskQuestion**：`中止合并` / `使用对方版本` / `使用我方版本` / `暂停手动解决`

### 步骤 21：合并后操作

**AskQuestion**：`保留源分支（推荐）` / `删除本地和远程源分支`

### 步骤 22：展示最终摘要

动态生成摘要（跳过的阶段标记「⏭️ 已跳过」），包含：change 名称、归档路径、审查报告路径、各阶段状态、决策点选择、提交信息与变更统计。

---

## 错误处理速查

| 场景 | 处理 |
|------|------|
| openspec CLI 不可用 / 非 git 仓库 | 提示安装/初始化并退出 |
| change 不存在 | 列出可用 change 让用户选择 |
| apply 返回 `blocked` | 回到 Phase 1 补充制品 |
| 审查时无变更可审 | 提示后进入 Phase 5 |
| 修复循环达 3 轮上限 | 强制暂停，提示人工介入 |
| verify 无法解析 | 查候选命令，仍不确定则询问用户 |
| 归档目标已存在 | 由 CLI 或追加 `-N` 后缀处理 |
| 无法确定测试命令 | 列出候选请用户选择 |
| 单元测试失败 | 修复后重试或终止 |
| 分支落后/分叉/rebase 冲突 | pull --rebase / 继续 / 终止 |
| 推送失败 | pull --rebase 重试或终止 |
| 合并冲突 | 中止/theirs/ours/手动解决 |
| 敏感文件检测 | 排除/包含/终止 |

## 中断恢复

选择「暂停流水线」或「终止流程」时，展示：
- change 名称、中断阶段、中断原因
- 各 Phase 完成状态清单
- **恢复指引**：重新触发此技能并传入 change 名称即可从断点继续
