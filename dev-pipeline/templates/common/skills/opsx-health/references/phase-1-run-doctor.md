# Phase 1：调用 doctor 取结果

## 目标

取得知识库健康检查的结构化结果，作为后续报告与修复建议的事实来源。

## 执行步骤

1. **优先调用 doctor（JSON）**

   无需全局安装时，按以下顺序解析 CLI（与 `opsx-dev-pipeline/scripts/dev-pipeline-resolve-cli.sh` 一致）：

   1. 全局 `opsx-dev-pipeline`（`npm install -g`）
   2. 仓库内 `node_modules/.bin/opsx-dev-pipeline`
   3. `npx --yes opsx-dev-pipeline`（**未全局安装时的默认回退**）

   **推荐**直接运行 bundled 脚本（自动解析 CLI）：

   ```bash
   bash <SKILL_ROOT>/opsx-health/scripts/opsx-health-run-doctor.sh
   ```

   或手动调用（在仓库根目录）：

   ```bash
   opsx-dev-pipeline doctor --json
   # 未全局安装时：
   npx --yes opsx-dev-pipeline doctor --json
   ```

   - 解析返回中的 `manifest` 与 `knowledge` 段：状态、评分（若有）、各项检查（断链 / 重复 / 老化 / 索引 / 占位等）。
   - 如需趋势对比，可使用 `--history`（落盘快照并对比上次得分）；如需调整老化阈值，可用 `--stale-days`。

2. **doctor 不可用时降级**
   - 若全局 CLI、本地 `node_modules` 与 `npx` 均不可用，或 doctor 命令执行失败：降级为基于现有存在性检查（`.knowledge/` 是否存在、`INDEX.md` 是否存在、是否有明显空文件/占位）产出报告。
   - 在报告中**明确标注**当前为降级模式，能力会随 doctor 增强而增强。

3. **无知识库时**
   - 若仓库既无 `.knowledge/` 也无项目既有知识目录：说明"暂无知识库可巡检"，并给出"是否初始化知识库"的建议，不报错。

## 输出要求

- 一份原始检查结果（doctor JSON 或降级检查结果）。
- 明确标注数据来源（doctor / 降级模式）。

## Guardrails

- 不重写 doctor 的检查规则；以其输出为准。
- 降级模式必须显式标注，避免让用户误以为是完整巡检。
- 本阶段只读取，不做任何写入。
