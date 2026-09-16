# Pipeline 门禁清单

> opsx-dev-pipeline 在 CLI 安装、流水线状态机、Skill 协议和宿主 Hook 四层分别设门禁。
> 本文档以当前实现为准（`dev-pipeline-state.mjs` Schema v3），区分**硬门禁**（脚本拒绝，exit 11）与**协议门禁**（Skill 要求 Agent 遵守，状态机不直接拦截）。
>
> 人工决策点的选项与审计字段见 [pipeline-decision-points.md](pipeline-decision-points.md)。术语定义见 [CONTEXT.md](../CONTEXT.md)。
> 将门禁做成「自动跳过 / 必须人工确认」配置的可行性见 [gate-configurability-feasibility.md](./gate-configurability-feasibility.md)。

---

## 1. 分层总览

| 层 | 位置 | 失败时 | 能否跳过 |
| --- | --- | --- | --- |
| CLI 安装 / 维护 | `init` / `upgrade` / 冲突策略 | 命令抛错或交互取消 | `--yes` / `--force` 改变冲突与确认行为 |
| Preflight | `preflight.mjs`；`init` 另有 OpenSpec 版本检查 | 非零退出，无副作用 | git 用户信息缺失仅警告 |
| 状态机硬门禁 | `dev-pipeline-state.mjs` 的 `transition` / `init` / `attempt` / `route` / `complete` | exit 11，状态不迁移 | 显式记录允许值后才能通过；Route 不可降级 |
| Skill 协议门禁 | Phase reference / command 模板 | Agent 必须停下来问用户 | 部分可显式跳过并写入 `gatesBypassed` / 对应 status |
| Hook 运行时拦截 | `block-dangerous-bash.mjs` / `block-sensitive-write.mjs` | PreToolUse deny（exit 2） | Feature `hooks`；stdin 解析失败默认放行 |

`executionMode`（`pipeline` / `standalone` / `hybrid`）只做执行来源审计，**不再**放宽 `transition` 或自动批准门禁。向前跳 Phase 时，中间每一道硬门禁都会累计检查。

状态命令约定：

| exit code | 含义 |
| --- | --- |
| 0 | 成功 |
| 10 | 状态文件不存在 |
| 11 | 非法迁移或未满足门禁 |
| 12 | I/O 失败或 `_version` 乐观锁冲突 |

---

## 2. CLI 安装与维护门禁

这些门禁保护消费方仓库的托管 Asset，不进入流水线状态机。

### 2.1 OpenSpec CLI 版本（`init` Preflight）

`runInit()` 在任何写入前调用 `preflightOpenSpec()`：

| 条件 | 结果 |
| --- | --- |
| PATH 中找不到 `openspec` | 拒绝，提示安装 `@fission-ai/openspec` |
| `openspec --version` < `1.6.0` | 拒绝 |

实现：`src/core/init/runInit.ts`。流水线运行时的 `preflight.mjs` **不**做 SemVer 下限检查，只要求命令可执行。

### 2.2 非交互 `init` 必须给 Stack

`--yes` 且未传 `--stack` 时直接拒绝（`frontend` / `backend` / `fullstack` 三选一）。

### 2.3 文件冲突策略

`init` / `sync` / `upgrade` 对已存在的托管文件：

| 标志 | 行为 |
| --- | --- |
| 默认 | 交互选择覆盖 / 跳过 /（可追加时）追加 |
| `--yes` | 跳过冲突文件 |
| `--force` | 覆盖冲突文件 |

Asset 级 `writePolicy` 可把部分文件标为 append（例如 `openspec/config.yaml`）。

### 2.4 Manifest 版本门禁（仅 `upgrade`）

比较 `package.json#opsxDevPipeline.templateVersion` 与当前 CLI 版本：

| `checkManifestVersion` 结果 | 交互 `upgrade` | `--yes` / `--dry-run` |
| --- | --- | --- |
| `current` / `outdated` | 打印说明后继续 | 继续 |
| `ahead` / `unknown` | 询问「Continue upgrade anyway?」，拒绝则抛错 | **跳过确认并继续** |

实现：`src/core/manifest/versionCheck.ts`、`src/core/upgrade/versionPrompt.ts`。`sync` **没有**这道检查。Doctor 只报告，不拦截。

> CONTEXT.md 写「`init` / `sync` / `upgrade` 都受版本门禁控制，且 `--yes` 在版本不匹配时拒绝」。当前代码仅 `upgrade` 实现该检查，且 `--yes` 会放行。

### 2.5 Node 运行时

`package.json#engines.node` 要求 `>=20`。Hook 脚本同样假设 Node 20+。

---

## 3. Preflight（流水线入口）

Phase 0 Step 1 必须先跑 `node <SKILL_ROOT>/scripts/preflight.mjs`。失败则退出，不写状态。

| 退出码 | reason | 处理 |
| --- | --- | --- |
| 1 | `openspec-cli-not-found` / `openspec-version-failed` / `node-cli-not-found` | 安装 Node 20+ 与 OpenSpec 后重试 |
| 2 | `not-a-git-repo` / `git-cli-not-found` | 进入 Git 仓库或安装 git |
| 3 | `openspec-not-initialized` | 缺少 `openspec/config.yaml`，或 `openspec list` 的 `root.source=implicit` |
| 5 | `openspec-list-failed` | 检查 OpenSpec 配置 |
| 6 | `openspec-list-json-invalid` | 检查 OpenSpec 输出版本 |

警告（不阻断）：`git-config-user-name-missing`、`git-config-user-email-missing`。提交前仍必须配置。

---

## 4. 状态机硬门禁

权威实现：`src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` 中的 `validateGates()`。`transition` 向前跳时对每一相邻 Phase 累计校验。测试：`test/pipeline/gates.test.ts`。

### 4.1 Phase 迁移门禁

```
Phase0 ──► Phase1 ──► Phase2 ──► Phase3 ──► Phase4 ──► Phase5 ──► Phase6 ──► Phase7
                         ▲          │
                         └──────────┘  Phase2 也可直接到 Phase4（跳过审查）
```

合法邻接（`allowedTransition`）还包括回退：Phase2/3→1、Phase4→2、Phase5→1/2。邻接表允许的跳转仍必须通过对应门禁。

| 迁移 | reason | 通过条件 | 对应决策 |
| --- | --- | --- | --- |
| 进入 Phase 2 | `proposal-approval-required` | `decisions.proposalApproved === true` | 决策点 1：确认提案 |
| 离开 Phase 2（目标 ≥ 3） | `implementation-confirmation-required` | `decisions.implementationConfirmed === true` | 决策点 2：实施完成确认 |
| 进入 Phase 5 | `test-gate-required` | `tests.status` ∈ `passed` / `skipped` / `debt-recorded` | 决策点 4：单测或显式跳过 / 技术债务 |
| 进入 Phase 6 | `verify-gate-required` | `verify.status` ∈ `passed` / `skipped` | Step16 verify |
| 进入 Phase 6 | `archive-required` | `archivePath` 非空 | Step18 归档成功 |
| 进入 Phase 6 | `post-archive-decision-required` | `postArchiveAction` ∈ `merge` / `push-only` / `local-only` | 决策点 5b |
| 进入 Phase 7 | `merge-gate-required` | `postArchiveAction === 'merge'` | 仅 merge 模式进 Phase 7 |
| 进入 Phase 7 | `commit-required` | `delivery.commitSha` 已记录 | 决策点 6 提交成功 |
| 进入 Phase 7 | `source-push-required` | `delivery.sourcePushed === true` | 源分支已推送 |

说明：

- 进入 Phase 3 / 4 **没有**额外硬门禁；Phase 2→4（跳过审查）只需 `implementationConfirmed`。
- `tests.status=pending` 或 `failed` 不能进 Phase 5；`failed` 必须先修到 `passed`，或改成 `skipped` / `debt-recorded`。
- `verify.status=failed` 不能进 Phase 6，必须 `passed` 或用户确认后的 `skipped`。
- `complete` 仅允许当前 Phase 为 6 或 7，否则 `pipeline-not-delivered`。

### 4.2 首次 `init`：外部需求关联

创建状态文件前必须二选一，禁止从上下文推断跳过：

| reason | 触发 |
| --- | --- |
| `feature-association-decision-required` | 既无 `--feature-id` 也无 `--skip-feature-association` |
| `feature-id-required` | 有 `--feature-url` 但无 `--feature-id` |
| `feature-association-options-conflict` | `--skip-feature-association` 与关联参数同时出现 |

### 4.3 Route 门禁

Route 决定**允许进入哪些 Phase**，阶段列表的单一事实源是 `openspec/config.yaml#pipeline.routes`。

| Route | 默认 Phase 集合 |
| --- | --- |
| `trivial` | {0, 2, 6} |
| `standard` | {0, 1, 2, 5, 6} |
| `full` | {0, 1, 2, 3, 4, 5, 6, 7}（旧状态缺 `route` 时默认） |

| reason | 规则 |
| --- | --- |
| `phase-not-in-route` | `transition` 目标 Phase 不在当前 Route 列表中 |
| `route-downgrade-not-allowed` | 只能 `trivial → standard → full`，禁止降级或同级「升级」 |
| `invalid-route-name` | 目标不是三档之一 |

升级命令：`dev-pipeline-state.mjs route <change> upgrade <target>`，写入 `route.upgradedFrom` / `route.upgradedAt`。详见 ADR 0002。

即使 Route 跳过某 Phase，累计硬门禁仍可能要求补齐字段（例如 `trivial` 从 0 跳到 2 仍要 `proposalApproved=true`）。Skill 层应在跳过的阶段做 **gate 补偿**（见第 7 节），而不是绕过 `transition`。

### 4.4 重试上限（自动暂停）

`attempt <change> <review|tests|verify> <status>` 连续失败 3 次后：`status=paused`，exit 11。

| scope | 失败状态 | reason |
| --- | --- | --- |
| `review` | 最近 3 轮均为 `issues-found` | `review-attempt-limit-reached` |
| `tests` | `failed` 累计 3 次 | `tests-attempt-limit-reached` |
| `verify` | `failed` 累计 3 次 | `verify-attempt-limit-reached` |

审查轮次在一次 `passed` 后重新计数。暂停后必须人工介入，禁止 Agent 自行清计数继续。

### 4.5 其它状态机拒绝

| reason | 场景 |
| --- | --- |
| `pipeline-transition-not-allowed` | 目标既不在邻接表中，也无法用已满足的累计门禁解释的向前跳转 |
| `pipeline-state-concurrent-modification` | `_version` 乐观锁冲突（exit 12）；只允许重载重试一次 |
| `pipeline-state-migration-required` | `record-phase` 要求 Schema v3；旧文件需 `migrate-schema --confirm` |
| `invalid-change-name` | 名称须为 1–64 位 kebab-case，不能以连字符开头或结尾 |
| `invalid-state-field` | `set` 写入了非白名单字段，或非法 `executionMode` |

---

## 5. Skill 协议门禁（状态机不直接拦截）

下列规则写在 Phase reference / command 模板里，依赖 Agent 先问用户、再写状态、最后 `transition`。漏记时硬门禁会在下一步挡住；漏问时硬门禁帮不上忙。

### 5.1 与硬门禁对应的必过确认

| 决策 | 硬性规则 |
| --- | --- |
| 决策点 1 确认提案 | 用户未选「确认提案，开始实施」前禁止进 Phase 2 |
| 决策点 2 实施确认 | 任何离开 Phase 2 的路径都必须先写 `implementationConfirmed` |
| 决策点 4 单测 | 不得默认跳过；`skipped` / `debt-recorded` 必须是用户显式选择 |
| 决策点 5b 归档后动作 | `postArchiveAction` 禁止从 Git / 文件系统推断 |
| 决策点 6 提交 | commit 与 source push 分开确认；禁止 `git add -A`、`git push --force` |
| Phase 7 合并 | merge / target push / 删分支 / 打标签分别确认 |

「继续后续流程」只跳过**当前** Phase 的剩余步骤，不得跳过后续 Phase 的决策点。

### 5.2 Phase 内软门禁

| 名称 | Phase | 通过条件 |
| --- | --- | --- |
| 写前复用门禁 | 2 | 动手前检索已有相近实现，命中则复用 |
| 准出自审查门禁 | 2 | 12 项自审全部满足才允许把任务标为 `[x]` |
| 修复提案门禁 | 3 | 「生成修复提案并应用」必须先写 `fix-proposal-round-N.md` 并等用户批准 |
| archive 前 verify | 5 | 无适用命令时由用户确认 `verify.status=skipped`；禁止未确认就 `archive.mjs -y` |
| 敏感文件扫描 | 6 | `.env` / 密钥 / credentials 等逐一确认排除或保留 |
| `--no-verify` | 6 | 作为独立高风险决策再次确认 |
| 合并后回归 | 7 | 在 target HEAD 重跑已记录的 tests / verify，失败禁止 push |

### 5.3 状态与事实不一致

恢复或交付时并行核对：OpenSpec change、任务勾选、审查报告、Git 分支与冲突。不一致则 `pause`，禁止按文件是否存在自动跳阶段。

---

## 6. Hook 运行时拦截

Feature `hooks` / `no-hooks` 互斥。Claude Code / OpenCode 可自动写入 PreToolUse；Cursor / Codex 需按 [docs/hooks/](./hooks/cursor.md) 手动接入。脚本在 `<SKILL_ROOT>/scripts/hooks/`。

### 6.1 `block-dangerous-bash.mjs`

| deny reason | 匹配 |
| --- | --- |
| `destructive-rm-blocked` | `rm -rf /`、`~`、`.` 及同类 |
| `force-push-blocked` | `git push --force` / `--force-with-lease` / `-f` |
| `force-branch-delete-blocked` | `git branch -D` / `--force`（小写 `-d` 放行） |
| `world-writable-chmod-blocked` | `chmod 777` / `chmod -R 777` |
| `remote-pipe-shell-blocked` | `curl`/`wget` 管道进 `sh`/`bash`/`zsh` |
| `filesystem-format-blocked` | `mkfs` |
| `raw-disk-write-blocked` | `dd if=` |

### 6.2 `block-sensitive-write.mjs`

| deny reason | 匹配 |
| --- | --- |
| `git-internal-write-blocked` | `.git/` |
| `pipeline-state-write-blocked` | `openspec/.pipeline-state/*.json`（只能走状态脚本） |
| `sensitive-env-blocked` | `.env` / `.env.*` |
| `sensitive-credentials-blocked` | `credentials.json` / `service-account.json` |
| `sensitive-key-blocked` | `*.key` / `*.pem` / `*.p12` / `*.pfx` / `*.secret` |

解析失败或超时默认放行（exit 0），由宿主 `failClosed` 决定是否再拦。

---

## 7. Gate 补偿（standalone / hybrid 续接）

独立命令（`/opsx:propose`、`/opsx:apply`、`/opsx:archive` 等）可能留下 `executionMode=standalone|hybrid` 且部分门禁未记。Phase 0 检测到后，必须先补偿再继续，禁止猜测：

| 缺失字段 | 用户选项 | 持久化 |
| --- | --- | --- |
| `tests.status=pending` | `passed` / `failed` / `skipped` / 重新运行 | `set tests.status`；重跑则进 Phase 4 |
| `verify.status=pending` | `passed` / `failed` / `skipped` / 重新验证 | `attempt verify` 或 `set verify.status skipped` |
| `postArchiveAction` 缺失且将进 Phase 6 | `merge` / `push-only` / `local-only` | `decision`，禁止从 Git 推断 |

补偿结果写入后再 `get` 自检。跳过的门禁记入 `gatesBypassed`（审计，不代替硬门禁）。

---

## 8. Doctor（只读，不是门禁）

`npx opsx-dev-pipeline doctor` 不写文件、不阻断流水线：

- Manifest 是否存在、`templateVersion` 与 CLI 是否对齐
- `--stack` / stack-only：校验 `openspec/config.yaml` 的 stack profile（id、services 路径、required 命令）

升级建议通过 `healthStatus`（`ok` / `warn` / `fail`）输出。

---

## 9. 按 Phase 速查

| Phase | 硬门禁（进/出） | 协议门禁 | Route 默认是否执行 |
| --- | --- | --- | --- |
| 0 入口 | Preflight；需求关联；Route 选择 | 续接 / 状态重建 / gate 补偿 | 三档都有 |
| 1 提案 | 出：`proposalApproved` | 决策点 1a、决策点 1 | standard / full |
| 2 应用 | 出：`implementationConfirmed` | 写前复用、准出自审查、决策点 2 | 三档都有 |
| 3 审查 | 无额外硬门禁 | 决策点 3、修复提案、3 轮上限 | 仅 full |
| 4 单测 | 出：`tests.status` 合法 | 决策点 4、技术债务文档 | 仅 full |
| 5 归档 | 出：verify + archivePath + postArchiveAction | 禁止未确认 `-y`、Delta spec 同步 | standard / full |
| 6 提交推送 | 出（进 7）：commitSha + sourcePushed + merge | 分步暂存、敏感文件、分开确认 push | 三档都有 |
| 7 合并交付 | 仅 merge 模式可入 | 合并策略、冲突、target push、标签 | 仅 full |

---

## 10. 相关实现与测试

| 内容 | 路径 |
| --- | --- |
| 硬门禁与 Route | `src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` |
| Preflight | `src/templates/common/skills/opsx-dev-pipeline/scripts/preflight.mjs` |
| Phase 协议 | `src/templates/common/skills/opsx-dev-pipeline/references/phase-*.md.hbs` |
| CLI OpenSpec 预检 | `src/core/init/runInit.ts` |
| Manifest 版本 | `src/core/manifest/versionCheck.ts` |
| 硬门禁测试 | `test/pipeline/gates.test.ts` |
| Route 测试 | `test/unit/route-transition.test.ts`、`test/integration/route-e2e.test.ts` |
| 人工决策点 | [docs/share-doc/pipeline-decision-points.md](./share-doc/pipeline-decision-points.md) |
| Route ADR | [docs/adr/0002-route-selector.md](./adr/0002-route-selector.md) |
