# Phase 0: 入口判断

**`<SKILL_ROOT>`**：本技能安装根目录（内含 `scripts/`），命令在目标 git 仓库根目录执行。

## 步骤 1：环境预检

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-preflight.sh
```

- openspec CLI 不可用 → 提示安装并退出
- 不在 git 仓库中 → 提示 `git init` 或进入正确仓库后退出

## 步骤 2：判断入口类型

### 2.a 用户提供了已有 change 名称

1. 运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"` 检查状态
   - change 不存在 → 运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-list-changes.sh` 展示可用 change
2. 按优先级判断续接阶段（优先回到最早未完成阶段）：
   - 制品未完成 → 推荐 Phase 1
   - 制品完成但任务未完成 → 推荐 Phase 2
   - 任务完成且无审查报告 → 推荐 Phase 3
   - 已有审查报告但未归档 → 推荐 Phase 4（完成后进入 Phase 5）
   - 已归档且有未提交变更 → 推荐 Phase 6 步骤 17
   - 已归档且有未推送提交 → 推荐 Phase 6 步骤 19
3. 使用 **AskQuestion** 确认：`从 Phase X 继续` / `从头开始（新建 change）` / `终止流程`

### 2.b 用户提供了需求描述

- 从描述推导 kebab-case 的 change 名称
- 进入 **Phase 1 步骤 2.9（决策点 1a）**

### 2.c 用户未提供任何输入

- 发送文本消息询问需求描述或 change 名称，等待回复后走 2.a 或 2.b
