# Phase0: 入口判断

**`<SKILL_ROOT>`**：本技能安装根目录（内含 `scripts/`），命令在目标 git 仓库根目录执行。

## Step1：环境预检

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-preflight.sh
```

解析返回 JSON，按 `status` 和 `reason` 处理：

| 退出码 | reason | 处理 |
|--------|--------|------|
| 1 | `openspec-cli-not-found` / `openspec-version-failed` / `node-cli-not-found` | 提示安装 Node.js 20+ 与 `@fission-ai/openspec` 并退出 |
| 2 | `not-a-git-repo` | 提示 `git init` 或进入正确仓库后退出 |
| 3 | `openspec-not-initialized` | 提示执行 `openspec init` 后退出 |
| 4 | `invalid-change-name` / `missing-argument` / `no-ready-artifact` | 修正输入后重试 |
| 5 | `*-failed` | 展示命令失败详情，修复后重试 |
| 6 | `*-json-invalid` / `command-output-empty` | 暂停并检查 OpenSpec 版本或输出 |

- `warnings` 字段非空 → 展示警告清单，确认后继续

## Step2：判断入口类型

### 2.a 用户提供了已有 change 名称

1. 读取持久化状态：
   ```bash
   node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<name>"
   ```
2. 并行核对事实：活跃/归档 change、任务勾选、状态中记录的审查报告、Git 分支和冲突状态。
3. 状态不存在但 change 存在时，展示检测事实并询问：`按检测结果重建状态` / `选择其他 change` / `终止流程`。只有用户确认后才执行 `init` 和必要的 `set`/`transition`。
4. 状态与事实不一致时，列出差异并执行 `pause`；禁止按文件是否存在自动跳阶段。
5. 状态一致时使用 **AskQuestion** 确认：`从记录的 Phase/Step 继续` / `从头开始（新建 change）` / `终止流程`。

### 2.b 用户提供了需求描述

- 从描述推导 kebab-case 的 change 名称
- 获取当前分支并初始化状态，然后迁移到 Phase1：
  ```bash
  node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs init "<name>" "<source-branch>"
  node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 1 3
  ```
- 进入 **Phase1 Step3（决策点 1a）**

### 2.c 用户未提供任何输入

- 发送文本消息询问需求描述或 change 名称，等待回复后走 2.a 或 2.b
