## Why

opsx-dev-pipeline 当前在 8 个阶段的提示词里反复用「显式禁令 + 用户决策点」约束 LLM 行为（如「禁止 `git push --force`」「禁止写敏感文件」「推荐 ≠ 自动代选」），但这些约束全部依赖 LLM 自律，没有宿主层面的强制拦截。一旦模型「自作主张」就会绕开门禁。

需要把流水线里**横切且高风险**的约束（危险命令拦截、敏感文件写入拦截）从提示词层下沉到宿主 hook 层，让 Claude Code / OpenCode 等宿主在工具执行前后强制拦截。

## What Changes

- 新增通用 hook 脚本（shell 实现，跨工具复用）：
  - `scripts/hooks/block-dangerous-bash.sh`：拦截 `rm -rf /`、`git push --force`、`git branch -D`、`chmod 777`、`curl | sh` 等危险命令
  - `scripts/hooks/block-sensitive-write.sh`：拦截写入 `.env*`、`*.key`、`*.pem`、`credentials.json`、`openspec/.pipeline-state/*.json`
- 新增 Claude Code 模板：`templates/tools/claude/overlay/.claude/settings.json.hbs`，由 `init` 自动渲染项目级 `settings.json`，注册上述两个 hook
- 新增 OpenCode 模板：`templates/tools/opencode/opencode.json.hbs`，由 `init` 自动渲染项目级 `opencode.json`，注册同样的 hook
- `tools.json` 增加 `hooks` capability 字段（`claude` / `opencode` 启用，`cursor` / `codex` 标记 `manual`），`supports` 数组加 `"hooks"`
- 不生成 Cursor / Codex 的 hook 模板（前者用户手写 `hooks.json`，后者 hooks 仍实验），但 `init` 后输出文档指引
- 加 `--feature hooks` 显式开关，默认启用

## Capabilities

### New Capabilities

- `pipeline-hooks`: 流水线宿主管控层，包括通用 hook 脚本（危险命令拦截、敏感文件写入拦截）、Claude Code `settings.json` 渲染模板、OpenCode `opencode.json` 渲染模板，以及按工具启用的 feature flag 机制

### Modified Capabilities

无（不改现有 capability 的 REQUIREMENTS，仅新增）

## Impact

- 受影响的代码：
  - `src/config/tools.json`：加 `hooks` capability 声明
  - `src/core/adapters/types.ts`：`FeatureId` 加 `'hooks'`、`ALL_FEATURE_IDS` 同步
  - `src/core/adapters/registry.ts`：`supports('hooks')` 透传到 `StaticToolAdapter`
  - `src/core/init/buildInstallPlan.ts` / `executeInstallPlan.ts`：识别新 feature，注册 hook 模板渲染
  - `src/templates/common/scripts/hooks/`：新增两个跨工具的 shell 脚本（占位在 common 目录，运行时 copy 到 skill 目录或独立目录）
  - `src/templates/tools/claude/overlay/.claude/settings.json.hbs`：新模板
  - `src/templates/tools/opencode/opencode.json.hbs`：新模板
- API 影响：CLI 新增 `--feature hooks` 选项（可与已有 `--feature structural-analysis-hint` 共存）；`init` 默认行为对 `claude` / `opencode` 启用 hooks，对 `cursor` / `codex` 输出文档
- 向后兼容：`init --yes` 在已初始化仓库上跳过已有 `settings.json`（与现有冲突策略一致）；`--feature no-hooks` 显式禁用
- 测试影响：新增 hook 脚本单元测试（每个危险模式一条用例）+ 模板渲染集成测试
- 文档影响：`README.md` 增加「Pipeline Hooks」章节，`docs/templates/` 加 hook 配置示例
