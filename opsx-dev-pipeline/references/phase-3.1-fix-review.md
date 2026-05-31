---
name: phase-3.1-fix-review
description: Phase 3 决策点 3 子流程：用户选择「生成修复提案并应用」时执行（最多 3 轮）。衔接 phase-1-propose.md、phase-2-apply.md 与修复类归档。
compatibility: 需要 git、openspec；与 phase-3-review.md 步骤 8–10 产出的审查报告衔接。
---

## 「生成修复提案并应用」子流程（最多循环 3 轮）

**触发**：在 `phase-3-review.md` **步骤 11 [决策点 3]** 中，用户选择 **「生成修复提案并应用」** 后进入本子流程（严重/重要场景与「仅有一般或建议」场景中若含该选项，语义相同）。

**与「直接修复并重新审查」的界限**：本路径**必须**先落盘 OpenSpec 修复 change（`openspec/changes/<fix-name>/` 下制品）并经 **Phase 1 决策点 1**（见下）后，才允许改业务代码；**不得**把本选项执行成「无 change、直接打补丁」。

### a. 根据审查报告确定修复 scope

- **名称（kebab-case）**：`fix-cr-<主要问题类型>`（如 `fix-cr-security`、`fix-cr-convention`、`fix-cr-mixed`）
- **多轮时追加轮次**：`fix-cr-<type>-round-2`
- **写入制品的材料**：问题列表、影响文件、修复方案、审查报告路径引用

### b. 新建修复 change 并生成制品（等价 Phase 1，禁止依赖外部「提案」子技能）

- 执行 `openspec new change "fix-cr-<type>"`（或本项目封装脚本）；名称冲突时按 `phase-1-propose.md` **步骤 3** 的冲突处理
- 按 `phase-1-propose.md` **步骤 3** 生成/填写 `openspec/changes/fix-cr-<type>/` 下所需制品（`proposal.md`、`design.md`、`tasks.md`、delta specs 等以项目 openspec 规则为准），使 **`tasks.md` 仅描述本次 CR 修复项**
- **硬门禁**：在下一步 **决策点 1** 用户明确选择「确认提案，开始实施」之前，**仅允许**编辑 `openspec/changes/fix-cr-<type>/`、`openspec/review/` 等制品与报告路径引用；**禁止**对业务源码做修复性修改（读代码、列计划除外）

### c. 修复提案门禁（等价 Phase 1 决策点 1，必选）

展示修复提案与 `tasks.md` 要点摘要（对照审查报告），严格按 `phase-1-propose.md` **步骤 4** 使用 **AskQuestion**（三选项：`确认提案，开始实施` / `提案不符合预期，我要补充/修改` / `终止流程`）。

- 未选「确认提案，开始实施」→ **不得**进入 **步骤 d**
- 选「终止流程」→ 按该决策点语义退出；若用户要放弃已创建的 `fix-cr-*`，清理对应目录后再结束
- **禁止**用本节旧文案「确认提案，开始修复」或附录摘要式标签**替代** Phase 1 决策点 1 的三选项（避免跳过正式提案确认）
- 若用户决定**不再走 fix change、直接归档原来的需求 change**：仍通过「终止流程」退出本 fix 子流程；删除已创建的 `openspec/changes/fix-cr-<type>/`（若存在），并提示用户以**原 change 名称**从 `phase-5-unit-tests.md` 续跑（完成后再进入 `phase-4-archive.md`；本 fix 子流程结束；**不**在此路径内执行针对 `fix-cr-*` 的归档，除非用户明确要继续完成 fix）

### d. 逐任务实施修复（等价 Phase 2）

仅当 **步骤 c** 已选「确认提案，开始实施」后：对 change **`fix-cr-<type>`** 执行 `phase-2-apply.md` **步骤 5–7**（`opsx-instructions-apply.sh "<name>"` / 等价 `openspec instructions apply`），按 `tasks.md` 勾选任务；**禁止**跳过 **步骤 b–c** 直接改业务代码。

### e. 归档修复 change

修复类 change 通常无 delta specs：**跳过 Phase 4 步骤 14** 的 delta 对话时，可用 `--skip-specs`；若有 delta 需合并则去掉该 flag。

```bash
bash <SKILL_ROOT>/scripts/opsx-archive.sh "fix-cr-<type>" -y --skip-specs
```

**等价**：`openspec archive "fix-cr-<type>" -y --skip-specs`；失败时再用 `mkdir` + `mv` 手动归档（同 Phase 4 降级说明）。

### f. 重新审查（下一轮）

重新执行 **步骤 9–11**（代码审查），进入下一轮。

### g. 三轮上限

若 3 轮后仍有严重问题，强制暂停并提示用户手动介入，展示恢复指引后退出。
