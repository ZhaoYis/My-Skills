## Context

opsx-dev-pipeline 当前在 8 个 phase 提示词里用「显式禁令 + 用户决策点」约束 LLM 行为，但全部依赖 LLM 自律。Claude Code / OpenCode 提供了 hook 层强制拦截能力（PreToolUse 事件、exit code 2 + JSON `permissionDecision: deny`），可以把横切风险（危险 Bash、敏感文件写入）从提示词下沉到宿主强制层。

`src/templates/tools/claude/` 目前只有 `overlay/CLAUDE.md.{en,zh}.hbs`，未生成 `settings.json`；`src/templates/tools/opencode/` 目录还不存在（4 工具中只有 claude/cursor 在 `tools/` 下）。Cursor 有 `hooks.json` 但云端 agent `beforeSubmitPrompt` 不可用；Codex hooks 仍实验性（v0.141+），都不在第一档范围。

`scripts/` 目录目前存放的是 opsx-dev-pipeline 自身的脚本（`pipeline-lib.mjs` 等），hook 脚本应放到 `src/templates/common/scripts/hooks/` 由 init 复制到目标仓库 `.claude/scripts/hooks/` 或独立 `<SKILL_ROOT>/hooks/`。

## Goals / Non-Goals

**Goals:**

- 提供 2 个跨工具复用的 shell hook 脚本（危险 Bash、敏感文件 Write）
- 给 Claude Code 与 OpenCode 提供 Handlebars 模板，`init` 自动渲染
- 在 `tools.json` 加 `hooks` capability 与 `metadata.hooks.mode`，让 adapter 层识别
- 提供 `--feature hooks` / `--feature no-hooks` 显式开关
- 端到端可测试（Vitest 单测 + 模板渲染集成测试）

**Non-Goals:**

- 不实现 PostToolUse 监听、SessionStart 注入 pipeline state 等第二档能力
- 不生成 Cursor / Codex 的 hook 模板（输出文档指引）
- 不实现 OpenCode `experimental.session.compacting` 注入
- 不改 opsx-dev-pipeline 的 state schema（hook 仅做防御，不参与 state machine）
- 不做多工具统一 hook 抽象层（每工具独立配置）

## Decisions

### 决策 1：hook 脚本用 shell 而非 Node.js 实现

- **选择**：Bash + `jq` 实现
- **理由**：hook 在 Claude Code / OpenCode 跑时是子进程调用，shell 是最低公共分母；`jq` 在 macOS / Linux 几乎都预装；避免 Node.js 启动开销（每次 LLM 工具调用都会触发）
- **备选**：纯 Node.js（一致性好但启动慢 ~200ms）、TypeScript 编译产物（多一份 dist 产物管理）
- **影响**：需要在 README 注明 `jq` 是 hook 脚本的运行时依赖

### 决策 2：hook 脚本放到 `src/templates/common/scripts/hooks/` 并由 init 复制

- **选择**：源码在仓库 `src/templates/common/scripts/hooks/`，运行时 init 把它们复制到目标仓库 `.claude/scripts/hooks/`（Claude）或 `.opencode/scripts/hooks/`（OpenCode）
- **理由**：`src/templates/` 是已存在的「待 init 渲染/复制的资产」目录；与现有 `src/templates/common/scripts/dev-pipeline-state.mjs` 等模式一致（这些脚本也是被 init 复制到目标仓库）
- **备选 A**：直接放进 `dist/` 引用全局路径——版本绑定困难
- **备选 B**：放到 npm package 让目标仓库 `npm install`——引入新依赖
- **影响**：每个 init 都会 copy 两个脚本；sync/upgrade 时按 manifest 判断是否更新

### 决策 3：Claude Code 模板用 `overlay/` 子目录与现有结构对齐

- **选择**：`templates/tools/claude/overlay/.claude/settings.json.hbs`
- **理由**：现有 `templates/tools/claude/overlay/CLAUDE.md.{en,zh}.hbs` 走的同一路径，buildInstallPlan 已识别 `overlay/` 目录并渲染
- **影响**：无需改 `buildInstallPlan`，新增 1 个 `.hbs` 文件自动被识别

### 决策 4：OpenCode 模板放到 `src/templates/tools/opencode/`（新建目录）

- **选择**：与 claude/cursor 平级建 `tools/opencode/opencode.json.hbs`，**不放进 `overlay/`**
- **理由**：OpenCode 的 hooks 配置 `opencode.json` 不是 overlay 文件（Claude 的 CLAUDE.md 是增量叠加，opencode.json 是覆盖式），需要直接渲染到目标路径；这与现有 `src/config/tools.json` 中 `opencode` 的 `destinations.root: "."` 一致
- **影响**：buildInstallPlan 可能需要补一条「非 overlay 模板直接渲染到 destinations」的逻辑（与现有 `destinations.skills` 渲染对齐）

### 决策 5：hooks capability 用 `metadata.hooks.mode` 二元（auto/manual）

- **选择**：`{ mode: "auto" | "manual" }`，auto 自动渲染，manual 仅输出文档
- **理由**：第一档范围只有 claude/opencode 真渲染，cursor/codex 仅文档；用 mode 而非布尔 capability 字段表达，扩展性强（未来加 `plugin`、`notify` 等 mode）
- **备选**：`supports: ["hooks"]` 布尔数组——无法表达 manual/auto 差异
- **影响**：`StaticToolAdapter.supports(feature)` 仍返回布尔，但 `executeInstallPlan` 根据 `metadata.hooks.mode` 分流

### 决策 6：deny 协议用 Claude Code 的 JSON 格式（OpenCode 兼容）

- **选择**：`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"<rule>"}}` + exit code 2
- **理由**：Claude Code 的 hookSpecificOutput 协议在 OpenCode 中是兼容字段（前文调研已确认）；exit code 2 是 Claude Code 的 deny 约定，也是 OpenCode 兼容约定
- **影响**：单一脚本可同时被两家调用，无需针对每个工具写 wrapper

### 决策 7：Handlebars 条件渲染 `{{#if hooksEnabled}}`

- **选择**：在两个 .hbs 模板里用 `{{#if hooksEnabled}}...{{/if}}` 包裹 hooks 节点
- **理由**：当 `--feature no-hooks` 时仍生成有效 JSON 结构（不破坏 OpenSpec 配置语法），只 hooks 数组为空
- **影响**：Handlebars 上下文需新增 `hooksEnabled` 布尔字段

### 决策 8：deny 时输出 reason 用国际化 key 而非中文

- **选择**：reason 输出英文短语如 `force-push-blocked`，permissionDecisionReason 由宿主展示时翻译
- **理由**：与现有 `package.json` 的 i18n 策略一致（reason 是机器字符串，不应本地化）；用户 UI 文案本地化在别处处理
- **影响**：reason 必须稳定，跨版本不变（测试用字符串匹配）

## Risks / Trade-offs

- **`jq` 缺失**：macOS/Linux 大多有，但 Alpine / Windows WSL 可能没装 → 在 init 后输出 doc 提示「请确认 `jq` 可用」，并在 hook 脚本内检测 `command -v jq`，缺失时直接放行 + stderr WARN
- **hook 路径绝对化**：OpenCode 在仓库子目录跑时，相对路径需以仓库根为基准 → 模板渲染时把 hook 路径转为相对仓库根的 `.claude/scripts/hooks/xxx.sh`（OpenCode 已确认以仓库根解析）
- **误伤正常命令**：`rm -rf` 的白名单规则可能放过 `rm -rf build/` 之类合法清理 → 用「路径是否含 `/` 绝对路径或 `~` 或 `.`」启发式判断（保守策略）；无法判断时放行（白名单兜底）
- **OpenCode hook matcher 大小写**：调研显示 OpenCode 用小写 `bash`/`write`/`edit` → 模板里 matcher 用 `bash|write|edit`，Claude 模板用 `Bash|Write|Edit|MultiEdit`，分别适配
- **hook 性能**：每次 LLM 工具调用都跑一次 shell → 目标 < 50ms（实测 `jq` + 简单正则可在 10ms 内完成）
- **init 失败回滚**：如果 `settings.json` 渲染后语法错误，整个 init 失败 → 渲染时用 `JSON.parse` 验证模板输出，失败时回退到「不写文件 + 报错」
- **与 `pipeline-state` 状态文件冲突**：若用户已编辑 `openspec/.pipeline-state/*.json`，hook 会 deny 写入 → spec 错误信息明确提示「请用 `node dev-pipeline-state.mjs` 系列命令」
- **未来扩展性**：第一档只做 Claude/OpenCode，未来加 Codex 需补模板 → 在 docs/hooks/ 留 `codex.md` 文档骨架，等 Codex hooks 稳定后补实现

## Migration Plan

### 部署步骤

1. 在 feature 分支上实现（不直接 main）
2. 单元测试覆盖每个危险命令匹配 case
3. 在 `metrics-server` 之类的 mock 仓库跑 `init --tool claude --yes --dry-run`，确认渲染产物合法
4. 真实跑 `init --tool claude --yes --force` 到 dev-pipeline 自己，验证 `.claude/settings.json` 落地、hook 脚本可执行
5. 用 `cat .claude/settings.json | jq .` 验证 JSON 合法
6. 在 dev 仓库手动测试：触发 `rm -rf /` 模拟命令，确认 Claude Code 真的 deny

### 回滚策略

- `--feature no-hooks` 重新 init 生成空 hooks 配置
- 或 `npx opsx-dev-pipeline sync --force` 重新渲染
- hook 脚本本身：手动删除 `.claude/scripts/hooks/` 和 `.opencode/scripts/hooks/` 即可
- 不需要数据迁移（hook 是 stateless 的）

## Open Questions

1. **hook 路径前缀**：是用绝对路径还是相对仓库根的相对路径？取决于 Claude Code 在目标仓库子目录跑时的解析行为 → 实施时跑实际测试确认，必要时在 README 加 fallback
2. **hook 脚本可执行权限**：init 时是否需要 `chmod +x`？→ Node.js 模板渲染产物体是 644；Claude Code 调用 hook 需 755；需要 init 后处理
3. **OpenCode 的 `experimental` 字段保留**：当前模板只放 hooks，是否需要保留 `experimental.session.compacting` 占位？→ 第一档先不加，留 Open Question 等用户实际使用 OpenCode 时反馈
4. **是否需要 `--no-hooks` 简写**：避免用户写 `--feature no-hooks` 长选项？→ 暂不加，保持 feature 命名一致性
