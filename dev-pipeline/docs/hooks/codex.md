# Codex Hook 状态（占位）

Codex CLI 的 hook 能力正在快速演进，本文档跟踪 opsx 与 Codex hooks 的集成状态。

## 当前（v0.120.0+ 稳定）

Codex 仅暴露一个稳定的外部 hook：

```toml
# ~/.codex/config.toml — 必须在任何 [table] 之前
notify = ["python3", "/path/to/notify.py"]
```

事件载荷通过命令行参数传递：

```json
{
  "type": "agent-turn-complete",
  "turn-id": "...",
  "thread-id": "...",
  "cwd": "...",
  "input-messages": [...],
  "last-assistant-message": "..."
}
```

**只支持 `agent-turn-complete` 事件**，且 `notify` hook 是 fire-and-forget（无法 deny 工具调用），所以不适合做强制门禁。

## 实验性（v0.141+）

Codex 0.141 起在 `[features] hooks = true` 后支持：

```toml
[features]
hooks = true

[[hooks.PreToolUse]]
matcher = "*"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "sh ~/.codex/mint.sh"
timeout = 600
```

事件：`UserPromptSubmit` / `PreToolUse` / `PostToolUse`。仍属 feature flag，稳定性不足。

## opsx 集成策略

- **当前**：不生成 Codex 的 hook 模板；hook 模式标记为 `manual`。
- **未来**：等 Codex hooks 进入 stable 后，在 `templates/tools/codex/` 下加 `config.toml.hbs`，复用同一份 `block-*.mjs` 脚本。

## 推荐临时方案

在 Codex 稳定 hooks 之前，可用 notify hook 做审计：

```bash
#!/usr/bin/env bash
# ~/.codex/hooks/audit-notify.sh
# 把 Codex 任务完成事件追加到 opsx 状态文件（不参与门禁）
echo "$(date -Iseconds) $1" >> ~/.codex/audit.log
```

```toml
# ~/.codex/config.toml
notify = ["bash", "/Users/you/.codex/hooks/audit-notify.sh"]
```

## 参考

- [Codex CLI Notification Pipeline](https://codex.danielvaughan.com/2026/04/13/codex-cli-notification-pipeline-osc9-hooks-alerts)
- [Codex Custom Instructions](https://developers.openai.com/codex/docs/custom-instructions)
- [openai/codex issues/2543 — Centralized session hook management](https://github.com/openai/codex/issues/2543)
