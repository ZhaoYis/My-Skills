## 1. 通用 Hook 脚本实现

- [x] 1.1 创建 `src/templates/common/scripts/hooks/block-dangerous-bash.sh` 骨架（shebang + 读取 stdin + jq 解析 + exit 0/2）
- [x] 1.2 在 `block-dangerous-bash.sh` 中实现 `rm -rf /|~|\.` 模式匹配（含路径启发式判断绝对路径命中主目录/系统目录）
- [x] 1.3 在 `block-dangerous-bash.sh` 中实现 `git push --force` / `--force-with-lease` / `git branch -D` 拦截
- [x] 1.4 在 `block-dangerous-bash.sh` 中实现 `chmod 777` / `chmod -R 777` 拦截
- [x] 1.5 在 `block-dangerous-bash.sh` 中实现 `curl|wget <url> | sh|bash|sudo sh` 模式拦截（含 `mkfs` / `dd if=`）
- [x] 1.6 在 `block-dangerous-bash.sh` 中实现 deny JSON 输出协议（hookSpecificOutput + permissionDecision + exit 2）与 fail-closed 语义
- [x] 1.7 创建 `src/templates/common/scripts/hooks/block-sensitive-write.sh` 骨架（与 1.1 类似）
- [x] 1.8 在 `block-sensitive-write.sh` 中实现 `*.env` / `*.env.*` / `*.key` / `*.pem` / `*.p12` / `*.pfx` / `*.secret` / `credentials.json` / `service-account.json` 路径匹配
- [x] 1.9 在 `block-sensitive-write.sh` 中实现 `openspec/.pipeline-state/*.json` 路径匹配 + 自定义 deny reason（提示用 state 命令）
- [x] 1.10 在 `block-sensitive-write.sh` 中实现 `.git/` 路径匹配 + jq 缺失检测（缺失时 WARN + 放行）
- [x] 1.11 给两个 hook 加可执行权限（chmod +x）+ 在仓库内 git add 时处理（确保 tracked）

## 2. Hook 脚本单测

- [x] 2.1 创建 `test/hooks/block-dangerous-bash.test.ts`，用 vitest + child_process 调用脚本，覆盖：rm -rf / / git push --force / git branch -D / chmod 777 / curl | sh / mkfs / 普通命令放行 / stdin 解析失败放行
- [x] 2.2 创建 `test/hooks/block-sensitive-write.test.ts`，覆盖：.env / .env.local / *.key / credentials.json / openspec/.pipeline-state/x.json / .git/HEAD / 普通 src/*.ts 放行 / 工具名大小写兼容（Bash/bash）
- [x] 2.3 添加 `npm run test:hooks` 脚本到 package.json（仅跑 hook 测试），便于本地快速验证

## 3. Claude Code settings.json 模板

- [x] 3.1 创建 `src/templates/tools/claude/overlay/.claude/settings.json.hbs`，定义 PreToolUse.Bash + PreToolUse.Write|Edit|MultiEdit 两条 hook，含 timeout 5000、failClosed true
- [x] 3.2 在模板中用 Handlebars `{{#if hooksEnabled}}` 条件渲染 hooks 节点；为 false 时输出空 `{}` 占位
- [x] 3.3 在模板中处理 SKILL_ROOT 注入：使用相对路径 `.claude/scripts/hooks/<script>.sh`，并验证路径在模板渲染时已存在
- [x] 3.4 加权限提示 reason 文案：用英文 reason key（force-push-blocked 等），与 spec 对齐

## 4. OpenCode opencode.json 模板

- [x] 4.1 创建 `src/templates/tools/opencode/opencode.json.hbs`（新建 `tools/opencode/` 目录），定义 hooks.PreToolUse 两条（matcher `bash` + `write|edit`，小写）
- [x] 4.2 在模板中用 `{{#if hooksEnabled}}` 条件包裹，false 时输出空 hooks
- [x] 4.3 验证 buildInstallPlan 能识别非 overlay 模板路径并渲染到 `destinations.root`（若不识别需在 buildInstallPlan 加分支，标记为独立 task）
- [x] 4.4 [conditional] 若 4.3 失败：在 `src/core/init/buildInstallPlan.ts` 加「tools/<id>/ 非 overlay 文件直接渲染到 destinations.root」的分支

## 5. tools.json 与 adapter 类型扩展

- [x] 5.1 在 `src/config/tools.json` 给 claude/opencode 加 `metadata: { hooks: { mode: "auto", template: "..." } }`；给 cursor/codex 加 `metadata: { hooks: { mode: "manual" } }`
- [x] 5.2 在 `src/core/adapters/types.ts` 把 `FeatureId` 加 `'hooks'`，`ALL_FEATURE_IDS` 同步
- [x] 5.3 在 `src/core/adapters/registry.ts` 扩展 `ToolDefinition` schema 接受 `metadata?: { hooks?: { mode: ..., template?: ... } }`
- [x] 5.4 在 `StaticToolAdapter` 加 `getHookMode(): "auto" | "manual" | undefined` 方法；改 `executeInstallPlan` 在 mode=auto 时调用 hook 模板渲染，manual 时输出 doc 指引

## 6. CLI feature 开关

- [x] 6.1 在 `src/cli/commands/init.ts` 加 `--feature hooks` / `--feature no-hooks` 解析；放在已有 `--feature` 解析逻辑旁，复用 `collectInputs.ts` 的 feature 收集
- [x] 6.2 在 `collectInputs.ts` 加 hooksEnabled 派生逻辑：`no-hooks` 强制 false，`hooks` 强制 true（仅在该 tool 的 hookMode 不为 undefined 时生效），未传时按 tool 默认
- [x] 6.3 加 hooks/no-hooks 互斥校验：同时传时 exit code 1，错误信息「`hooks` 与 `no-hooks` 互斥」
- [x] 6.4 加 init 帮助文本：在 `--feature` 选项说明里加 `hooks` / `no-hooks` 用法

## 7. 模板渲染集成测试

- [x] 7.1 创建 `test/templates/claude-settings.test.ts`：渲染 settings.json.hbs，验证输出含两条 PreToolUse、JSON.parse 合法、failClosed=true、timeout=5000
- [x] 7.2 创建 `test/templates/opencode-config.test.ts`：渲染 opencode.json.hbs，验证 hooks.PreToolUse 含两条、matcher 小写、JSON 合法
- [x] 7.3 创建 `test/integration/init-hooks.test.ts`：用 temp dir 模拟 init 跑 `--tool claude --feature hooks`，断言 `.claude/settings.json` 与 `.claude/scripts/hooks/*.sh` 都已落地，文件可执行

## 8. 文档更新

- [x] 8.1 在 `README.md` 加「Pipeline Hooks」章节，说明：第一档覆盖范围、Claude/OpenCode 自动启用、Cursor/Codex 手动配置路径、deny 规则列表
- [x] 8.2 创建 `docs/hooks/cursor.md`：手写 `hooks.json` 示例 + beforeSubmitPrompt 云端限制说明
- [x] 8.3 创建 `docs/hooks/codex.md`：当前 notify 限制 + 未来 hooks 启用方法（占位，待 Codex 稳定后补）
- [x] 8.4 在 `README.md` 的 `--feature` 选项表加 `hooks` / `no-hooks` 说明

## 9. 端到端验证

- [x] 9.1 在 dev-pipeline 自己跑 `npm run build` 确认模板编译产物含新 hook 模板
- [x] 9.2 在 test-pipeline 临时仓库跑 `npx opsx-dev-pipeline init --tool claude --yes --force`，验证 `.claude/settings.json` 与 `.claude/scripts/hooks/` 落地
- [x] 9.3 用 `cat .claude/settings.json | jq .` 验证 JSON 合法
- [x] 9.4 在该仓库用 Claude Code 实测：触发 `rm -rf /` 模拟命令，确认被 deny；触发普通命令确认放行
- [x] 9.5 对 OpenCode 重复 9.2-9.4 步骤
- [x] 9.6 验证回滚：`npx opsx-dev-pipeline sync --force` + `--feature no-hooks` 重新 init，确认 hooks 节点清空

## 10. 收尾

- [x] 10.1 更新 `openspec/changes/add-pipeline-hooks/` 状态：所有 tasks 已勾选，运行 `openspec status --change add-pipeline-hooks` 确认 isComplete
- [x] 10.2 在 `docs/feature-inventory.md` 加 hooks capability 条目
- [x] 10.3 提交到 feature 分支并 push
