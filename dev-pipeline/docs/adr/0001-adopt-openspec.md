# ADR 0001 — 采用 OpenSpec 作为变更驱动的骨架

- **状态**：已采纳
- **日期**：2025-08-28
- **范围**：架构

## 背景

`opsx-dev-pipeline` 用于编排一套 AI 辅助开发工作流。核心循环是：

1. 用户描述一个变更。
2. AI 起草 proposal / design / specs / tasks。
3. AI 依据 specs 实施 tasks。
4. 代码经过审查并合并。

我们需要决定如何在**消费方仓库**里表示这个循环。可选项有：

- **（a）从零自研一套变更驱动的状态机** —— 包括 propose / apply /
  archive 命令、schema、task 跟踪。
- **（b）采用 [OpenSpec](https://github.com/Fission-AI/OpenSpec)** 作为
  变更引擎，在它之上叠加我们自己的 phase / route 门禁。

## 决策

采用 **OpenSpec** 作为标准的 proposal / spec / task 引擎，并在其之上
叠加 Phase 0–7 与 Route 选择器作为**第二层状态机**。

具体来说：

- `init` 调用 `openspec init --tools <tool>` 搭建 OpenSpec 布局
  （`openspec/changes/`、`openspec/specs/`、`openspec/schemas/`）。
- `propose`、`apply`、`archive` 与 OpenSpec 原生命令**一一对应**，我们不
  重新实现。
- Phase 3（审查）、Phase 4（单测门禁）、Phase 6（提交推送）、Phase 7
  （合并）由我们自己实现 —— 它们填补 OpenSpec 的 verify 与真正把代码
  交付上线之间的空白。
- manifest 持久化 `templateVersion`，使 `doctor` 与 `upgrade` 能检测到
  未来的 OpenSpec 升级。

## 影响

**正面**

- 零维护 proposal / spec / task 机制。OpenSpec 负责这块能力面，并自带
  schema 校验。
- 消费方受益于 OpenSpec 日益完善的工具集成（Cursor、Codex、Claude
  Code），无需我们重新实现 adapter。
- `init` 预检门禁 OpenSpec 1.6+ 版本，给运行时缺失或版本过低的情况一个
  干净的失败路径。

**负面**

- 我们与 OpenSpec 的 CLI 契约、schema 格式、发布节奏强耦合。OpenSpec 的
  一次破坏性变更会迫使本仓库同步升级。
- manifest 必须能向前兼容旧版 OpenSpec（`schemaVersion: 1`），以保证
  `sync` / `upgrade` 在异构环境下仍可用。

**中性**

- OpenSpec 是外部依赖，我们不内嵌它。`init` 要求 OpenSpec 已被安装到
  `PATH`，并在 README 快速开始中明确说明。

## 备选方案

- **自研 proposal 引擎**：拒绝。要赶上 OpenSpec 现有能力需要 6 个月以上
  工作，而且会失去生态一致性。
- **基于其他变更工具（如纯 git-hooks）**：拒绝。无法为消费方提供 AI
  agent 读取的 `proposal.md` / `design.md` / `specs/` 结构化布局。
