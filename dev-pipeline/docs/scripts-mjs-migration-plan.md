# 脚本改造方案：Bash → Node.js .mjs

> 版本: v1.1 | 日期: 2026-07-25 | 状态: 设计阶段 — 已评审（grilling session 完成）

## 一、背景与目标

### 现状问题

`opsx-dev-pipeline` Skill 的 `scripts/` 目录包含 10 个 bash 脚本（9 个入口脚本 + 1 个共享库 `dev-pipeline-lib.sh`）和 1 个 `.mjs` 模块。当前架构存在以下问题：

1. **双语言维护负担**：核心 CLI 工具链是 TypeScript/Node.js，但流水线脚本是 bash。开发者需要在两种语言、两套工具、两种错误处理模式之间切换
2. **bash 难以承载复杂逻辑**：`preflight.sh`（2,979 B）和 `instructions.sh`（2,187 B）已经出现了在 bash 中内嵌 Node.js 来解析 JSON 的模式——这本身就是"bash 不够用"的信号。后续流水线逻辑增长（条件分支、状态管理、错误恢复），bash 的维护成本会非线性上升
3. **跨平台能力不足**：bash 脚本使用大量 bash 专属语法（`BASH_SOURCE`、`[[ ]]`、数组、`${var//pattern}`），且部分脚本内嵌 Node.js 做 JSON 解析。虽然 Git Bash/WSL 可以运行，但无法在 `cmd.exe`/PowerShell 原生环境执行

### 目标

将所有脚本统一为 **Node.js .mjs 格式**，与项目主体技术栈一致，零新增依赖，并为后续流水线逻辑演进铺平道路。

---

## 二、方案选型

### 2.1 为什么选 .mjs 而不是其他方案

#### 2.1.1 Git Bash/WSL（不迁移）

理论上 Git Bash 已随 Git for Windows 安装，且当前脚本的 bash 专属特性全部被 Git Bash 支持。外部依赖（`openspec`、`git`、`node`）在 Git Bash/WSL 中均可正常工作。**不迁移的直接成本为零。**

不选这条路径的原因：它不解决双语言维护负担和 bash 复杂逻辑承载力的问题。

#### 2.1.2 Python vs .mjs

| 维度 | Python | .mjs (Node.js) |
|------|--------|-----------------|
| 新增依赖 | Python 3.9+（当前可选） | **零**（Node.js 20+ 已是硬依赖） |
| `dev-pipeline-state.mjs` | 需要完全重写（12KB/364 行） | **保留不动** |
| JSON 处理 | `json` 模块 | 原生 `JSON.parse/stringify` |
| 子进程调用 | `subprocess.run()` | `execFileSync` |
| 跨平台 | 良好 | 良好 |
| 与 CLI 工具同语言 | 否 | **是**（TypeScript → 编译为 JS） |
| Windows | 需安装 Python | Node.js 通用 |

---

## 三、架构设计

### 3.1 文件结构

```
templates/common/skills/opsx-dev-pipeline/scripts/
├── pipeline-lib.mjs           ← 共享模块（新建，替代 dev-pipeline-lib.sh）
├── preflight.mjs              ← Phase 0 预检（替代 .sh）
├── new-change.mjs             ← Phase 1 创建 change（替代 .sh）
├── change-status.mjs          ← 查询 change 状态（替代 .sh）
├── list-changes.mjs           ← 列出 changes（替代 .sh）
├── instructions.mjs           ← 获取 artifact instructions（替代 .sh）
├── instructions-apply.mjs     ← 获取 apply 上下文（替代 .sh）
├── validate-change.mjs        ← 校验单个 change（替代 .sh）
├── validate-all.mjs           ← 批量校验（替代 .sh）
├── archive.mjs                ← 归档 change（替代 .sh）
└── dev-pipeline-state.mjs     ← 状态机（保留并重构，import pipeline-lib）
```

**删除文件：** 所有 9 个 `.sh` 文件 + `dev-pipeline-lib.sh`

### 3.2 调用方式变更

| 之前 | 之后 |
|------|------|
| `bash scripts/dev-pipeline-preflight.sh` | `node scripts/preflight.mjs` |
| `bash scripts/dev-pipeline-new-change.sh <name>` | `node scripts/new-change.mjs <name>` |
| `bash scripts/dev-pipeline-change-status.sh <name>` | `node scripts/change-status.mjs <name>` |
| `bash scripts/dev-pipeline-list-changes.sh` | `node scripts/list-changes.mjs` |
| `bash scripts/dev-pipeline-instructions.sh <name> [artifact]` | `node scripts/instructions.mjs <name> [artifact]` |
| `bash scripts/dev-pipeline-instructions-apply.sh <name>` | `node scripts/instructions-apply.mjs <name>` |
| `bash scripts/dev-pipeline-validate-change.sh <name>` | `node scripts/validate-change.mjs <name>` |
| `bash scripts/dev-pipeline-validate-all.sh` | `node scripts/validate-all.mjs` |
| `bash scripts/dev-pipeline-archive.sh <name>` | `node scripts/archive.mjs <name>` |
| `node scripts/dev-pipeline-state.mjs ...` | `node scripts/dev-pipeline-state.mjs ...`（不变） |

### 3.3 关键设计决策

- **保持独立文件**：10 个入口脚本各自独立，不合并为单文件子命令。AI 调用时命令直接映射到文件，无需记子命令名
- **共享模块导入**：所有脚本通过 `import { ... } from './pipeline-lib.mjs'` 引用共享函数，相对路径导入天然跨平台
- **纯函数式 repo 根路径**：`getRepoRoot()` 返回路径字符串（不 `cd`），`runJsonCommand()` 内部自动注入 `{ cwd: getRepoRoot() }`，调用方无需每次显式传 `cwd`
- **不加 shebang，用 `node` 前缀调用**：`.mjs` 文件不加 `#!/usr/bin/env node`，统一通过 `node scripts/xxx.mjs` 调用——与方案中所有调用方式一致，且 Windows 上 shebang 不生效
- **JSON 契约不变**：`emitError()` 和 `runJsonCommand()` 输出格式与当前 `lib.sh` 完全一致
- **`validateChangeName` 统一**：使用 `dev-pipeline-state.mjs` 的单一正则 `^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$`，补充 1-64 字符长度检查
- **退出码重新分配**：pipeline-lib.mjs 保持 1-6（与 lib.sh 一致），state.mjs 的退出码重映射到 10-12（避免与 pipeline-lib 冲突，7-9 预留扩展）
- **`maxBuffer` 设为 10MB**：`runJsonCommand` 内部 `execFileSync` 的 `maxBuffer` 设为 `1024 * 1024 * 10`
- **两阶段命令检查**：`requireCommand()` 先在 PATH 中验证命令存在（EOENT → exit 1），`runJsonCommand` 中出现的 ENOENT 当 exit 5 处理
- **跨平台路径规范化**：所有输出 JSON 中的路径在 `runJsonCommand` 和 `emitError` 中统一规范化，确保跨平台一致
- **`dev-pipeline-state.mjs` 重构**：import `pipeline-lib.mjs`，统一使用 `getRepoRoot()`、`validateChangeName()`、`emitError()`，删除内部重复的 ~30 行工具代码
- **`preflight.mjs` 和 `instructions.mjs` 借机增强**：保留核心逻辑，在 Node.js 中自然改进健壮性（更好的错误消息、更清晰的 JSON 处理），不局限于逐行翻译
- **升级路径暂不处理**：项目处于开发阶段，暂无正式用户，不设计 `.sh` 文件的升级清理逻辑

---

## 四、`pipeline-lib.mjs` 接口设计

### 4.1 导出函数

| 函数 | 签名 | 用途 |
|------|------|------|
| `getRepoRoot()` | `() => string` | 执行 `git rev-parse --show-toplevel`（不 `cd`），失败则 emitError 退出 |
| `requireCommand(name, reason, nextAction)` | `(string, string, string) => void` | 检查 CLI 工具是否在 PATH，ENOENT 则 emitError（exit 1） |
| `validateChangeName(value)` | `(string) => void` | 校验 kebab-case 格式（正则：`^[a-z0-9][a-z0-9-]*[a-z0-9]$\|^[a-z0-9]$`），1-64 字符，不合法则 emitError |
| `validateIdentifier(label, value)` | `(string, string) => void` | 校验标识符格式，不合法则 emitError |
| `emitError(reason, detail, nextAction, exitCode)` | `(string, string, string, number) => never` | 输出 `{"status":"error",...}` JSON → `process.exit(exitCode)`。路径在输出前统一规范化 |
| `runJsonCommand(args, opts)` | `(string[], { failureReason, nextAction }) => object` | 执行命令（自动注入 `cwd: getRepoRoot()`，`maxBuffer: 10MB`）→ 捕获 stdout → `JSON.parse` → 返回解析后的对象。失败/空输出/非 JSON 则 emitError（exit 5/6） |
| `prepareOpenSpecRepo()` | `() => string` | 组合调用：`requireCommand('openspec')` + `requireCommand('node')` + `getRepoRoot()` → 返回 repoRoot |

> **实现细节：** `runJsonCommand` 内部对 `execFileSync` 的异常分类处理——非零退出码 → exit 5，ENOENT → exit 5（因为 `requireCommand` 已在前置阶段验证命令存在），空 stdout → exit 6，`JSON.parse` 失败 → exit 6。所有路径在输出前通过 `path.posix` 风格规范化。

### 4.2 退出码

`pipeline-lib.mjs` 保持与 `dev-pipeline-lib.sh` 一致的退出码（1-6），`dev-pipeline-state.mjs` 的退出码重新映射到 10-12 以避免冲突：

| 模块 | 常量 | 值 | 含义 |
|------|------|----|------|
| pipeline-lib | `EXIT_DEPENDENCY_MISSING` | 1 | 依赖的 CLI 工具未安装 |
| pipeline-lib | `EXIT_NOT_GIT_REPO` | 2 | 不在 Git 仓库内 |
| pipeline-lib | `EXIT_OPENSPEC_NOT_INITIALIZED` | 3 | openspec 未初始化 |
| pipeline-lib | `EXIT_INVALID_INPUT` | 4 | 输入参数不合法 |
| pipeline-lib | `EXIT_COMMAND_FAILED` | 5 | openspec 命令执行失败 |
| pipeline-lib | `EXIT_INVALID_OUTPUT` | 6 | openspec 返回非法 JSON |
| state.mjs | `EXIT_STATE_NOT_FOUND` | 10 | 状态文件不存在 |
| state.mjs | `EXIT_INVALID_TRANSITION` | 11 | 不合法的状态转换 |
| state.mjs | `EXIT_STATE_IO` | 12 | 状态文件读写失败 |

> **设计决策：** pipeline-lib.mjs 保持 1-6 不变（所有 `.sh`→`.mjs` 迁移的测试断言无需改动），state.mjs 跳到 10-12（7-9 预留 pipeline-lib 未来扩展）。需要同步更新 `test/integration/pipeline-state.test.ts` 中的 3 处 code: 4 断言 → code: 11。

### 4.3 JSON 输出契约

错误输出（与现有格式完全一致）：
```json
{"status":"error","reason":"<code>","detail":"<description>","nextAction":"<guidance>"}
```

`runJsonCommand` 成功时直接透传 `openspec` 命令的 JSON 输出（已验证为合法 JSON）。

---

## 五、各脚本分类与迁移复杂度

### 5.1 薄包装脚本（7 个，低复杂度）

| 脚本 | 核心逻辑 |
|------|---------|
| `new-change.mjs` | `openspec new change <name> --json` |
| `change-status.mjs` | `openspec status --change <name> --json` |
| `list-changes.mjs` | `openspec list --json` |
| `instructions-apply.mjs` | `openspec instructions apply --change <name> --json` |
| `validate-change.mjs` | `openspec validate <name> --type change --json --no-interactive` |
| `validate-all.mjs` | `openspec validate --all --json --no-interactive` |
| `archive.mjs` | `openspec archive <name> --json` |

**迁移模式：** 解析参数 → `prepareOpenSpecRepo()` → `runJsonCommand()` → 输出 JSON。

### 5.2 复杂脚本（2 个）

| 脚本 | 额外逻辑 | 迁移策略 |
|------|---------|---------|
| `preflight.mjs` | 检查 `openspec --version`、验证 `openspec/config.yaml` 存在、git 用户配置检查、解析 `openspec list --json` 的 `root.source`、构建带 warnings 数组的输出 | 保留核心检查逻辑，借机增强（更友好的错误消息、更清晰的 JSON 处理） |
| `instructions.mjs` | 自动检测 `openspec status` 中首个 `status: "ready"` 的 artifact | 借机重构更健壮（原生 JS 解析替代 bash 内嵌 node -e，更好的 artifact 名称验证） |

**迁移模式：** Node.js 中的 JSON 解析和数组操作比 bash 更简洁，这是迁移收益最大的两个脚本。

### 5.3 状态机（1 个）

| 脚本 | 改动 | 风险缓解 |
|------|------|---------|
| `dev-pipeline-state.mjs` | import `pipeline-lib.mjs`（`getRepoRoot()`、`validateChangeName()`、`emitError()`），退出码重映射（3→10, 4→11, 5→12）| 先写单元测试锁定当前行为 → 重构 → 测试全绿 |

重构范围限定为三个工具函数的替换和退出码常量更新，状态机核心逻辑（状态转换表、门禁检查、原子写入）不动。

---

## 六、模板文件中的脚本引用改动

迁移后所有模板文件（`SKILL.md.hbs` + `references/` 下的阶段指令）中的脚本调用需从 `bash ... .sh` 替换为 `node ... .mjs`。

### 6.1 SKILL.md.hbs

```diff
- bash <SKILL_ROOT>/scripts/dev-pipeline-preflight.sh
+ node <SKILL_ROOT>/scripts/preflight.mjs
```

状态机调用保持不变（本来就是 `node`）。

### 6.2 references/ 阶段指令文件

共 4 个文件、7 处调用需要替换：

| 文件 | 当前调用 | 替换为 |
|------|---------|--------|
| `references/phase-0-entrance.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-preflight.sh` | `node <SKILL_ROOT>/scripts/preflight.mjs` |
| `references/phase-1-propose.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-new-change.sh <name>` | `node <SKILL_ROOT>/scripts/new-change.mjs <name>` |
| `references/phase-1-propose.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-instructions.sh <name>` | `node <SKILL_ROOT>/scripts/instructions.mjs <name>` |
| `references/phase-1-propose.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-validate-change.sh <name>` | `node <SKILL_ROOT>/scripts/validate-change.mjs <name>` |
| `references/phase-2-apply.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-instructions-apply.sh <name>` | `node <SKILL_ROOT>/scripts/instructions-apply.mjs <name>` |
| `references/phase-5-archive.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh <name>` | `node <SKILL_ROOT>/scripts/change-status.mjs <name>` |
| `references/phase-5-archive.md` | `bash <SKILL_ROOT>/scripts/dev-pipeline-archive.sh <name>` | `node <SKILL_ROOT>/scripts/archive.mjs <name>` |

> **注意：** 这些文件是 AI agent 在各阶段执行时读取的指令模板。如果遗漏更新，agent 会按旧指令调用已删除的 `.sh` 脚本，导致迁移后流水线中断。

---

## 七、package.json 的 managedAssets 改动

**文件：`package.json`**

`opsxDevPipeline.managedAssets` 数组中有 9 个条目引用 `.sh` 文件，每个包含 `id` 和 `destination` 路径。迁移后需将所有条目替换为对应的 `.mjs` 文件：

| 当前 destination | 替换为 |
|-----------------|--------|
| `scripts/dev-pipeline-preflight.sh` | `scripts/preflight.mjs` |
| `scripts/dev-pipeline-new-change.sh` | `scripts/new-change.mjs` |
| `scripts/dev-pipeline-change-status.sh` | `scripts/change-status.mjs` |
| `scripts/dev-pipeline-list-changes.sh` | `scripts/list-changes.mjs` |
| `scripts/dev-pipeline-instructions.sh` | `scripts/instructions.mjs` |
| `scripts/dev-pipeline-instructions-apply.sh` | `scripts/instructions-apply.mjs` |
| `scripts/dev-pipeline-validate-change.sh` | `scripts/validate-change.mjs` |
| `scripts/dev-pipeline-validate-all.sh` | `scripts/validate-all.mjs` |
| `scripts/dev-pipeline-archive.sh` | `scripts/archive.mjs` |

`dev-pipeline-state.mjs` 条目保持不变（本来就是 `.mjs`）。

> **注意：** `managedAssets` 条目决定了 `opsx-dev-pipeline init` 时文件拷贝的目标路径。`.sh` → `.mjs` 后，destination 也必须同步更新，否则 init 阶段会因源文件不存在而失败。

---

## 八、asset manifest 改动

**文件：`src/core/assets/manifest.ts`**

Bundle 的 `includeExtensions` 需要更新：

```diff
{
  id: 'opsx-dev-pipeline-skill-bundle',
  kind: 'bundle',
  source: 'templates/common/skills/opsx-dev-pipeline',
- includeExtensions: ['.md', '.hbs', '.sh', '.mjs', '.yaml'],
+ includeExtensions: ['.md', '.hbs', '.mjs', '.yaml'],
- templateFiles: ['SKILL.md.hbs'],
+ templateFiles: ['SKILL.md.hbs'],
}
```

**删除的模板文件：** 9 个 `.sh` + `dev-pipeline-lib.sh`  
**新增的模板文件：** 9 个 `.mjs` + `pipeline-lib.mjs`

---

## 九、实现顺序

所有改动**原子地**在一个 commit 中完成，避免中间状态的测试断裂。顺序为逻辑执行步骤，实际提交时一次性完成。

| # | 步骤 | 涉及文件 | 风险 |
|---|------|---------|------|
| 1 | ✅ 创建 `pipeline-lib.mjs`（共享函数模块） | 新建 `templates/.../scripts/pipeline-lib.mjs` | 中 |
| 2 | ✅ 迁移 7 个薄包装脚本 | 新建 7 个 `.mjs` 文件 | 低 |
| 3 | ✅ 迁移 `preflight.mjs` | 新建文件 | 中 |
| 4 | ✅ 迁移 `instructions.mjs` | 新建文件 | 中 |
| 5 | ✅ 重构 `dev-pipeline-state.mjs` | 修改现有文件，import pipeline-lib，退出码 10-12 | 高 |
| 6 | ✅ 更新模板文件中的脚本引用 | `SKILL.md.hbs`（1 处）+ `references/`（4 文件，7 处） | 低 |
| 7 | ✅ 更新 `package.json` managedAssets | 9 个条目的 destination 路径 `.sh` → `.mjs` | 低 |
| 8 | ✅ 更新 asset manifest | `includeExtensions` 移除 `.sh` | 低 |
| 9 | ✅ 调整测试文件中的脚本引用 | 见下表（含 `pipeline-state.test.ts` 的退出码断言） | 中 |
| 10 | ✅ 删除旧文件 | 删除 9 个 `.sh` + `dev-pipeline-lib.sh` | 低 |
| 11 | ✅ 编译验证 + 全量测试 | `npm run build && npm test` | 低 |

> **注意：** 步骤 10（删除旧文件）放在步骤 9（调整测试文件）**之后**，确保测试调整完成后再移除旧脚本，而不是反过来。

### 测试改动明细

| 测试文件 | 影响级别 | 改动内容 |
|---------|---------|---------|
| `test/unit/pipeline-lib.test.ts` | **NEW** | 新建。独立单元测试 pipeline-lib.mjs 的 7 个导出函数。纯函数（`validateChangeName`、`validateIdentifier`）做到 100% 覆盖；副作用函数（`getRepoRoot`、`runJsonCommand` 等）通过 PATH 注入 mock 进行集成测试 |
| `test/integration/skill-scripts.test.ts` | HIGH | `runScript()`: `execFile('bash', [script.sh])` → `execFile(process.execPath, [script.mjs])`。mock `openspec` 策略不变（假 bash 脚本注入 PATH，`.mjs` 通过 `execFileSync` 调用时操作系统按 shebang 解析）。9 个 JSON 断言保持不变 |
| `test/integration/pipeline-state.test.ts` | MODERATE | 3 处退出码断言：`code: 4` → `code: 11`（`EXIT_INVALID_TRANSITION` 从 4 重映射到 11）。其余 `.mjs` 执行路径不变（已使用 `process.execPath`） |
| `test/unit/build-install-plan.test.ts` | LOW | 2 处 destination path 断言：`.sh` → `.mjs` |
| `test/integration/init-matrix.test.ts` | LOW | 6 处文件存在性断言：`.sh` → `.mjs` |

## 十、验证方案

验证采用**四层防线**策略：从基础设施到全量回归，逐层收敛风险。

### 第一层：pipeline-lib.mjs 单元测试

在 `test/unit/pipeline-lib.test.ts` 中独立验证共享模块的正确性。这是整个迁移的根基。

**纯函数（100% 覆盖）：**

| 函数 | 测试用例 |
|------|---------|
| `validateChangeName(value)` | 合法值、空串、leading/trailing dash、超长（>64 字符）、含大写/下划线/特殊字符、单字符合法值 |
| `validateIdentifier(label, value)` | 合法值、空串、含非法字符、超长 |
| `emitError(reason, detail, nextAction, exitCode)` | JSON 格式正确性（`status`/`reason`/`detail`/`nextAction` 字段）、`process.exit` 被调用且码正确、路径规范化 |

**副作用函数（通过 PATH 注入 mock 进行集成测试）：**

| 函数 | 测试方式 |
|------|---------|
| `getRepoRoot()` | 在临时 git 仓库中验证返回正确的 repo 根路径 |
| `requireCommand(name, ...)` | 传入存在/不存在的命令名，验证 exit 1 / 通过 |
| `runJsonCommand(args, opts)` | 注入假 `openspec` 到 PATH（和现有测试模式一致），验证成功 JSON 透传、非零退出码→exit 5、空 stdout→exit 6、非 JSON→exit 6、maxBuffer 溢出 |
| `prepareOpenSpecRepo()` | 组合验证：openspec/node 缺失、仓库内外场景 |

### 第二层：薄包装脚本等价性验证（Code Review）

7 个薄包装脚本的迁移模式固定（`解析参数 → prepareOpenSpecRepo → runJsonCommand → 输出 JSON`），每个脚本 10-20 行。Code review 逐行对照 bash 版和 .mjs 版：

- **检查点：** 参数解析逻辑一致、`runJsonCommand` 传入的 args 等价、JSON 输出路径一致
- **无需独立测试：** 等价性由 pipeline-lib 单元测试 + 第三层 JSON 断言保证

### 第三层：复杂脚本等价性验证（Code Review）

`preflight.mjs` 和 `instructions.mjs` 逻辑较多，但外部接口是 JSON 输出。Code review 重点：

- **`preflight.mjs`：** 检查顺序是否一致（version → git config → config.yaml → list → root.source）、warnings 聚合逻辑、每个 exit 的 JSON shape
- **`instructions.mjs`：** artifact 自动检测逻辑（`artifacts.find(a => a.status === "ready")`）、无 ready artifact 时的 exit 4、JSON 解析失败时的 exit 6

### 第四层：全量回归测试

```bash
npm run build        # TypeScript 零错误编译
npm test             # 全量测试，期望一次性全绿
```

**为什么期望一次性全绿：**

- pipeline-lib 退出码 1-6 不变 → `skill-scripts.test.ts` 的 9 个 JSON 断言无需改动
- mock `openspec` 策略不变 → 假 bash 脚本注入 PATH 的模式对 `.mjs` 被测脚本同样生效
- state.mjs 退出码 4→11，`pipeline-state.test.ts` 的 3 处断言在原子 commit 中同步更新
- 所有 `execFile('bash', [script.sh])` → `execFile(process.execPath, [script.mjs])` 在原子 commit 中一次性替换

### E2E 冒烟验证

```bash
# 在临时目录 init 后，手动执行脚本确认功能一致
cd /tmp/test-project
opsx-dev-pipeline init --tool claude --stack backend --yes
cd <project>
node .claude/skills/opsx-dev-pipeline/scripts/preflight.mjs
node .claude/skills/opsx-dev-pipeline/scripts/new-change.mjs test-feature
node .claude/skills/opsx-dev-pipeline/scripts/change-status.mjs test-feature
node .claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs init test-feature main
```

---

## 附录 A：Grilling 决策记录

> 2026-07-25 grilling session，共 17 个决策点。

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 迁移动机 | 统一技术栈（2）+ 为复杂逻辑铺路（3），非跨平台驱动 |
| 2 | `validateChangeName` 实现 | state.mjs 正则 `^[a-z0-9][a-z0-9-]*[a-z0-9]$\|^[a-z0-9]$` + 补充 1-64 长度检查 |
| 3 | 行为等价验证 | 逐行 code review 保证，不依赖测试覆盖 |
| 4 | 遗漏引用点 | `package.json` managedAssets（9 条目）+ `references/`（4 文件 7 处）→ 已写入文档 |
| 5 | 路径方案 | 纯函数式：`getRepoRoot()` 返回字符串，`runJsonCommand` 自动注入 `cwd` |
| 6 | `maxBuffer` | 10MB（`1024 * 1024 * 10`） |
| 7 | ENOENT 处理 | 两阶段：`requireCommand` 先验证 PATH（ENOENT→exit 1），`runJsonCommand` 中的 ENOENT→exit 5 |
| 8 | Shebangs | 不加 `#!/usr/bin/env node`，统一 `node` 前缀调用 |
| 9 | 退出码划分 | pipeline-lib: 1-6（不变），state.mjs: 10-12（从 3,4,5 重映射） |
| 10 | 实现策略 | 原子 commit，删旧 `.sh` 放在修测试之后 |
| 11 | pipeline-lib 测试 | `test/unit/pipeline-lib.test.ts` — 独立单元测试 |
| 12 | state.mjs 重构 | 先写测试锁定当前行为 → 重构（只换工具函数+退出码，核心逻辑不动）→ 测试全绿 |
| 13 | instructions.mjs | 借机重构更健壮（原生 JS 替代 bash 内嵌 node -e） |
| 14 | preflight.mjs | 借机增强（更友好错误消息），核心检查逻辑不变 |
| 15 | 升级路径 | 暂不考虑（项目开发阶段，无正式用户） |
| 16 | 跨平台路径 | `runJsonCommand` 和 `emitError` 中集中规范化路径 |
| 17 | Mock 策略 | 无需改动——假 openspec bash 脚本通过 PATH 注入的模式对 `.mjs` 同样生效 |
```
