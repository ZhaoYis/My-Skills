---
name: phase-5-unit-tests
description: 全局步骤 16，决策点 4b（是否编写/补充单测并运行或跳过）。完成后进入 phase-4-archive.md 步骤 12（归档前检查与 verify）。
when: Phase 3 审查完成后、进入 phase-4-archive.md 之前，必须先执行本文件规定的步骤；完成后再进入归档流程。
compatibility: 依赖项目栈的可执行单元测试命令；决断需 AskQuestion 或附录编号选项。
---

## Phase 5：审查后单元测试门禁

本 Phase 对应全局 **步骤 16**（内含 **步骤 16.1**、**步骤 16.2 [决策点 4b]** 与按需执行的 **子流程 A**）。

### 步骤 16.1：识别测试方式

结合 **项目基准**（`openspec/config.yaml`，其次 `AGENTS.md`，再次 `CLAUDE.md`）、schema / `stacks`、以及仓库根目录常见约定（如 `package.json`、`pom.xml`、`pyproject.toml`、`go.mod`、`Cargo.toml` 等），给出**推荐的单元测试命令**。

推荐优先级如下：

1. `schema = yzw-workflow` 时，优先依据 `bash <SKILL_ROOT>/scripts/opsx-change-context.sh "<name>"` 与 `stacks` 推导测试/验证路径
2. 其次读取 `openspec/config.yaml` 中显式约定的验证与测试规则
3. 最后再使用仓库构建文件启发式推导（示例：`mvn test`、`npm test`、`pytest`、`go test ./...`、`cargo test`）

- 若无法唯一确定：**列出 2–3 个候选命令**，并在 **AskQuestion** 或自由文本中请用户选定一种；用户也可直接回复惯用命令

### 步骤 16.2：[决策点 4b] 是否需要编写或补充单元测试？

使用 **AskQuestion tool** 询问（工具不可用时见 `recovery-guardrails-appendix.md` → **兼容性与降级** → 编号选项）。

**选项：**

- `需要：编写/补充单元测试并运行通过后再继续` — 执行下方 **子流程 A**
- `不需要：跳过单测环节` — 记录本次选择（建议在最终摘要中标注），**直接进入 `phase-4-archive.md` 步骤 12**
- `暂停流水线，稍后继续` — 展示恢复指引（从本文件 / Phase 5 **步骤 16** 续跑）后退出

### 子流程 A（用户选择「需要」时）

1. 对照 **Phase 3**（`phase-3-review.md`）审查范围与当前 `git diff`，说明拟补充或修改的测试文件/用例要点；测试的包路径、框架与风格须与 **项目基准**及仓库内**既有用例**一致

2. 编写或修改单元测试代码（仅自动化单测，不含手工 E2E；若项目将部分集成测试也归为同一命令，随项目惯例）

3. 执行 **步骤 16.1** 中已确认的测试命令（可加项目常用参数，如 `--batch-mode`、`-q`，以项目基准 `config.yaml` 中若有的约定为准）

4. **若测试失败**：输出失败摘要（命令、片段日志、相关路径），**AskQuestion**：
    - `修复代码或测试后重试` — 修补后回到 **子流程 A 步骤 3** 重新执行测试命令
    - `终止流程` — 退出并给恢复指引

5. **若测试通过**：**进入 `phase-4-archive.md` 步骤 12**

### verify 与单元测试的边界

- **单元测试**：指 Review 完成后、进入 Archive 前的代码质量门禁；是否编写/补充单测，仍由本 Phase 的决策点 4b 明确决定
- **verify**：指 schema / workflow 级门禁；若 `schema = yzw-workflow`，仍在 **Phase 4 步骤 13** 作为 archive 前前置条件执行
- 单元测试先于 verify，但二者职责不同；即便本 Phase 已跳过或已通过单元测试，也不得默认跳过 **Phase 4 步骤 13** 的 verify

### 执行纪律

- 若用户曾选 `不需要` 但后来在工作区增加了须验证的行为，可在 **步骤 12**（`phase-4-archive.md` 起点）之前自行要求重新回到 **步骤 16**（本文件）；执行方**不得**在未询问的情况下默认跳过 **决策点 4b**
- 护栏摘要亦见 `recovery-guardrails-appendix.md` → **Guardrails**（审查后单元测试门禁）
