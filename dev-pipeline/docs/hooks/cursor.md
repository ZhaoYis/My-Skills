# Cursor Hooks 手动配置指南

opsx-dev-pipeline 的 hook 脚本对 Claude Code 和 OpenCode 自动生成。Cursor 因为支持自家的 `.cursor/hooks.json` 协议（详见 [Cursor Cookbook > Hooks](https://github.com/cursor/cookbook/blob/main/hooks/README.md)），由你**手写一份 hooks.json** 来接入同样的拦截脚本。

## 为什么是手动

- Cursor 的 hooks 走 `.cursor/hooks.json`（与 Claude 的 `settings.json` 不同协议）。
- 当前 opsx 不生成此文件，避免与 Cursor 的云端 agent 行为不一致。
- 拦截脚本本身（`block-dangerous-bash.sh`、`block-sensitive-write.sh`）已经由 opsx 自动复制到 `<skillsDir>/opsx-dev-pipeline/scripts/hooks/`，可直接复用。

## 配置步骤

### 1. 确认 opsx 已复制 hook 脚本

```bash
ls .cursor/rules/opsx-dev-pipeline/scripts/hooks/
# block-dangerous-bash.mjs
# block-sensitive-write.mjs
```

### 2. 创建 `.cursor/hooks.json`

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "node .cursor/rules/opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs",
        "matcher": "*",
        "timeout": 5,
        "failClosed": true
      }
    ],
    "beforeFileEdit": [
      {
        "command": "node .cursor/rules/opsx-dev-pipeline/scripts/hooks/block-sensitive-write.mjs",
        "matcher": "*",
        "timeout": 5,
        "failClosed": true
      }
    ]
  }
}
```

### 3. 验证

触发一条危险命令（如 `rm -rf /`），确认 Cursor Agent 在执行前被拦截。`.cursor/hooks.json` 与 Claude `settings.json` 共用同一份脚本，行为一致。

## 限制

- `beforeSubmitPrompt`（用户提交 prompt 前）**仅在本地 Cursor 客户端生效**；Cursor 云端 agent 在 VM 创建前就已经提交了 prompt，所以云端 agent 不会被这条 hook 拦截。
- Cursor 没有 `prompt` 类型 hook（只能用 shell），如需 LLM 判断需自行包一层脚本。
