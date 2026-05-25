---
name: phase-4-archive
description: 全局步骤 12–15，含决策点 4。本阶段在 phase-5-unit-tests.md 步骤 16 完成后执行；归档完成后按决策点 4 进入 Phase 6 或终止。
compatibility: 需要 openspec CLI、git；归档推荐 opsx-archive.sh 或等价 openspec archive。
---

## Phase 4: 提案归档 (Archive)

### 步骤 12：检查制品和任务完成状态

1. **状态与校验**

    ```bash
    bash <SKILL_ROOT>/scripts/opsx-change-status.sh "<name>"
    ```

    **等价**：`openspec status --change "<name>" --json`

    （推荐）随后执行 `bash <SKILL_ROOT>/scripts/opsx-validate-change.sh "<name>"`，将结构问题在归档前暴露。

2. **任务**

    - 读取 `tasks.md` 检查未完成任务数量

3. **若存在未完成项**

    - 显示警告并使用 **AskQuestion tool**：
        - `继续归档` — 忽略未完成项，继续
        - `回到实施阶段` — 回到 Phase 2 继续实施
        - `终止流程` — 退出

### 步骤 13：archive 前 verify 门禁

1. **解析 verify 命令**

    - 若 `schema = yzw-workflow`：运行 `bash <SKILL_ROOT>/scripts/opsx-resolve-verify.sh "<name>"`，根据 change 的 `stacks` 推导 verify 命令
    - 解析结果至少应确认：`schema`、`stacks`、`command`
    - 推荐映射：
        - `stacks = [backend]` → `./scripts/validate.sh backend`
        - `stacks = [frontend]` → `./scripts/validate.sh frontend`
        - `stacks = [backend, frontend]` → 优先 `make validate`，若仓库无 `Makefile` 再回退 `./scripts/validate.sh all`
    - 默认 schema 若未声明 verify 规则：可跳过本步骤，继续后续 archive 检查

2. **执行 verify**

    - 若已解析出 verify 命令：执行该命令并记录结果
    - 记录内容至少包含：执行命令、退出码、失败时的关键日志片段
    - 若 verify 失败：使用 **AskQuestion tool**：
        - `修复后重试 verify` — 修复后回到本步骤
        - `暂停流水线` — 展示恢复指引后退出
        - `终止流程` — 退出

3. **门禁**

    - 若 `schema = yzw-workflow` 且 verify 未通过：**禁止**进入归档步骤
    - 若 `schema = yzw-workflow` 但无法解析 verify 命令：按附录 Error Handling 处理，在用户手动确认前不得宣称满足 verify-before-archive
    - verify 通过后，继续 **步骤 14**

### 步骤 14：Delta spec 同步检查

1. **检查**

    - 查看 `openspec/changes/<name>/specs/` 下是否有 delta specs

2. **若有 delta specs**

    - 对比 delta spec 与主 spec（`openspec/specs/<capability>/spec.md`），展示变更摘要
    - 使用 **AskQuestion tool**：
        - `同步到主 specs（推荐）` — 在 **步骤 14** 使用 `opsx-archive.sh "<name>" -y`（**无** `--skip-specs`）：由 OpenSpec 将 delta 合并进 `openspec/specs/` 并归档，无需手动拷贝
        - `不同步，直接归档` — 在 **步骤 14** 使用 `opsx-archive.sh "<name>" -y --skip-specs`：跳过对主 specs 的更新

### 步骤 15：执行归档

**推荐（与 OpenSpec CLI 一致）**：在用户完成 **步骤 13** 关于 delta 的选择后，用官方归档合并主 specs 并移动目录。

- **若步骤 13 选择同步 delta 到主 specs**（需要更新 `openspec/specs/`）：

    ```bash
    bash <SKILL_ROOT>/scripts/opsx-archive.sh "<name>" -y
    ```

- **若选择不更新主 specs**（工具链/文档类等）：

    ```bash
    bash <SKILL_ROOT>/scripts/opsx-archive.sh "<name>" -y --skip-specs
    ```

**等价**：`openspec archive "<name>" -y`（及必要时 `--skip-specs`）。CLI 会自动校验并将目录移到 `openspec/changes/archive/`，归档名含日期前缀。

**降级**：若 `openspec archive` 不可用或失败，可退回手动流程：`mkdir -p openspec/changes/archive`，生成 `YYYY-MM-DD-<change-name>`（冲突则追加 `-N`），再 `mv openspec/changes/<name> openspec/changes/archive/<目标目录>`（**不**含自动合并 specs，须与 **步骤 13** 用户意图一致）。

### 步骤 16：[决策点 4] 归档后操作

使用 **AskQuestion tool**。

**选项：**

- `提交代码并合并到目标分支` — 进入 **Phase 6** 完整流程（提交/推送/合并见 `phase-6-merge-push.md`）

- `仅提交并推送（不合并）` — 进入 **Phase 6**，执行 commit + push 后结束（同上文件）

- `终止流程` — 退出流水线（提供恢复指引）
