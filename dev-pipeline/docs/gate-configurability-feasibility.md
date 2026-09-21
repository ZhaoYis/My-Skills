# 门禁可配置化可行性

> 调研问题：能否把全部门禁做成配置，让用户自由决定哪些自动跳过、哪些必须人工确认。
>
> 结论先行：**不能把「全部门禁」做成可自由开关。** 可行的是在现有 Route 之上，增加一套**闭集、分层、可审计**的确认策略（confirmation policy），只覆盖「要不要问人」这一轴，不覆盖完整性、安全性和不可逆 Git 操作。
>
> 相关文档：[pipeline-gates.md](./pipeline-gates.md)、[pipeline-decision-points.md](./pipeline-decision-points.md)、[ADR 0002](./adr/0002-route-selector.md)。

---

## 1. 用户诉求拆开后其实是三件事

「跳过门禁」在现有系统里至少有三种完全不同的含义。混在一起配置，会再次出现 Phase 3「继续后续流程」一路自动 commit / push 的事故（见 `docs/phase-3-continue-gate-bypass-analysis.md`）。

```
                    ┌─────────────────────────────┐
  用户说「跳过」 ──► │ A. 不问人（确认策略）         │  ask → auto
                    │ B. 不做这项工作（工作策略）    │  run tests → skip tests
                    │ C. 不检查前置条件（完整性）    │  禁止配置
                    └─────────────────────────────┘
```

| 含义 | 例子 | 今天如何实现 | 能否做成配置 |
| --- | --- | --- | --- |
| A. 不问人，按默认项继续 | 提案确认直接视为通过 | Skill 强制 `{{askTool}}`，状态机要字段 | **有限度可以** |
| B. 不跑这项工作 | 不跑单测、不走审查 | Route 跳过整个 Phase；决策点里显式选「跳过」 | **已有，且应保持粗粒度** |
| C. 不满足条件也放行 | 没 commit 就进 Phase 7；状态与 Git 不一致继续 | `validateGates` / `pause` / Hook | **不可以** |

当前流水线已经把 B 交给 Route（三档 Phase 集合），把「这一次跳过」交给决策点选项。缺口主要在 A：同一仓库里每次 change 都要问同一批问题，无法设团队默认。

---

## 2. 已有能力：其实已经能「跳过工作」

ADR 0002 明确拒绝过「用户自由编排阶段列表」，理由是各团队流水线无法对齐、审计和升级无法复用。Route 就是当时给出的替代品：

| Route | 实际跳过的工作 | 仍会碰到的硬门禁 |
| --- | --- | --- |
| `trivial` | 提案、审查、单测、归档、合并 | 进 Phase 2 仍要 `proposalApproved`；进 Phase 6 仍要 verify / archivePath / postArchiveAction |
| `standard` | 审查、单测、合并 | 同上，外加提案与归档相关门禁 |
| `full` | 无 | 全部门禁 |

一次 change 内，用户仍然可以在决策点显式选择：

- D2.1 跳过审查
- D4.1 跳过单测
- D5.2 不同步 Delta spec
- D5.3 选 `push-only` / `local-only` 而不合并

这些跳过都会写入状态（`tests.status=skipped`、`reviewDisposition`、`gatesBypassed`），指标里的「门禁跳过率」也依赖这份审计。

**因此「自由决定跳过哪些工作」已经有通道，只是粒度是 Route + 当场选择，不是每道门禁一张开关表。**

真正缺的是：团队希望「trivial 默认不再问提案确认 / 单测确认」，而不是每次都弹一次。

---

## 3. 为什么「全部做成配置」不可行

### 3.1 门禁不在同一层，没有统一旋钮

| 层 | 执行者 | 配置后谁来遵守 | 忽略配置的后果 |
| --- | --- | --- | --- |
| 状态机硬门禁 | `dev-pipeline-state.mjs` | 脚本，可靠 | 不 `transition` 就绕过（历史事故） |
| Skill 协议门禁 | Agent 读 Markdown | 不可靠 | 不问人、或问了却不写状态 |
| Hook | 宿主 PreToolUse | 较可靠 | Feature 关掉 hooks 即失效 |
| CLI Preflight | `init` / `preflight.mjs` | 可靠 | 环境坏了仍往下写 |

把 18 个决策点 + 8 个硬门禁 + Hook 规则 + Preflight 塞进同一份 YAML，会让 Agent 以为「配置了 skip 就可以不跑 `transition`」。这正是 hybrid 时代 `applyGateInference()` 的失败模式。

### 3.2 有一类门禁语义上不能「自动跳过」

这些不是产品偏好，而是正确性 / 安全不变量。放进用户开关等于拆除流水线：

| 门禁 | 若允许 auto-skip |
| --- | --- |
| Preflight（无 git / 无 OpenSpec） | 后续脚本全部无定义 |
| `_version` 乐观锁、Schema 迁移确认 | 状态文件损坏 |
| 状态与 Git 事实不一致时暂停 | 在错误分支上 commit |
| `route-downgrade-not-allowed` | 已跳过的测试被「配置没了」 |
| Hook：`.pipeline-state` 直写、`.git/`、force-push、`rm -rf /` | 状态机失效、仓库被毁 |
| 合并冲突 | 无法用默认项自动解决 |
| `complete` 仅 Phase 6/7 | 未交付被标完成，指标作废 |
| 敏感文件纳入暂存 | 密钥进仓库 |

### 3.3 Skill 模板无法靠一份 YAML「自动不问」

Phase 0–5 的 `{{askTool}}` 大约 28 处，写死在 Handlebars 里。配置要生效，只有三条路：

1. **Agent 运行时读 config.yaml** — 实现便宜，执行不可靠；模型仍可能问、或仍可能不问就 push。
2. **`init` / `sync` 按配置渲染模板** — 每次改策略都要 `sync`；四套 Tool 目录各一份副本，冲突策略会再踩一脚。
3. **状态机在 `transition` 时按策略补写字段** — 可靠，但若 Skill 仍写着「必须问」，会出现「脚本已放行、Agent 还在问」或反过来。

可落地的设计必须 **双写**：脚本是权威，Skill 只描述「先查策略，auto 则写默认值并记录 bypass，ask 则 `{{askTool}}`」。只改一层等于没改。

### 3.4 解析器约束

消费方 `openspec/config.yaml` 的 Route 解析是 **零依赖、按行的子集解析器**（`parseRouteConfig`），只认识：

```yaml
  routes:
    trivial:
      description: "..."
      phases: [0, 2, 6]
```

CONTEXT.md 要求 hooks / 流水线脚本无外部运行时依赖。若确认策略做成深层嵌套 YAML，要么扩展这套脆弱解析器，要么引入 YAML 库，要么改用并列的 JSON。这是实现成本，不是否决项，但排除「先把任意 JSON schema 丢进 config.yaml」。

### 3.5 与 ADR 0002 冲突

「每道门禁自由开关」≈ 被拒绝的「可配置阶段列表」，只是粒度更细。后果相同：各仓库流水线不可比、`upgrade` 无法给出统一行为、指标里的跳过率失去分母。

---

## 4. 可行方案：确认策略，而不是门禁总开关

把配置轴限制为 **A（要不要问人）**，工作轴继续由 Route 决定。

### 4.1 策略取值（闭集）

| 值 | 含义 | 状态机 | Agent |
| --- | --- | --- | --- |
| `ask` | 必须人工确认（当前默认） | 字段未写则 exit 11 | `{{askTool}}` |
| `auto` | 采用该门禁的**已发布默认值**，不问人 | `transition` 前补写字段，并追加 `gatesBypassed` | 不询问，直接 `decision` / `set` |
| `block`（可选） | 连显式跳过都不允许 | `skipped` / `debt-recorded` 也拒绝 | 只给「执行并通过」 |

禁止第三种口语化取值（`skip`、`ignore`、`off`），避免被理解成「连工作都别做」。`auto` 的默认值必须写死在规格里，例如：

| 门禁 ID | `auto` 时写入 |
| --- | --- |
| `proposal-approval` | `proposalApproved=true` |
| `implementation-confirmation` | `implementationConfirmed=true` |
| `test-gate` | `tests.status=skipped`（**不是** `passed`） |
| `verify-gate` | `verify.status=skipped` |
| `post-archive-decision` | 必须另配默认值，不能猜 merge |
| `commit` / `source-push` | 见 4.3，默认不允许 `auto` |

`auto` 写成 `passed` 等于伪造测试结果，指标与技术债务会全部失真。

### 4.2 允许进配置的闭集

只开放与 `validateGates()` / 主决策点对应的 ID，例如：

```
feature-association
proposal-approval
implementation-confirmation
review-disposition          # auto = skip-review
test-gate
verify-gate
delta-spec-sync
post-archive-decision
commit
source-push
```

不开放：Preflight、乐观锁、Route 降级、事实不一致暂停、Hook 黑名单、合并冲突、attempt 上限、敏感文件、`--no-verify`、target push、删分支、打标签。

### 4.3 按风险分级默认值

| 级别 | 建议默认 | 是否允许仓库改成 `auto` |
| --- | --- | --- |
| 可逆、可审计 | 需求关联、审查 disposition、单测确认、verify 确认、Delta spec | 允许 |
| 方向性 | 提案确认、实施确认 | 允许，但 `full` Route 建议保持 `ask` |
| 交付方式 | `postArchiveAction` | 允许，但 `auto` 必须显式给出 `merge` \| `push-only` \| `local-only`，禁止缺省猜 merge |
| 不可逆 Git | commit、source push、merge、target push、删分支 | **默认 `ask`，第一版直接不开放 `auto`** |

第一版把不可逆操作排除出配置，能避开「配置了 skip 就自动 push」的最大风险。若以后要开放，应另做 ADR，并强制 `gatesBypassed` + 本地 diff 摘要写入状态。

### 4.4 建议挂在 Route 上，而不是全局一张表

Route 已经表达风险。确认策略应该是 Route 的附加维度，而不是绕过 Route 的第二套阶段表：

```yaml
pipeline:
  routes:
    trivial:
      description: "无行为变化的极小变更"
      phases: [0, 2, 6]
      confirmation:
        proposal-approval: auto
        test-gate: auto
        verify-gate: auto
        post-archive-decision: auto
        post-archive-default: local-only
    standard:
      phases: [0, 1, 2, 5, 6]
      confirmation:
        test-gate: auto          # Phase 4 本就不在 Route 内
        review-disposition: auto
    full:
      phases: [0, 1, 2, 3, 4, 5, 6, 7]
      # 全部 ask（缺省）
```

这同时修掉今天 Route 与累计硬门禁的矛盾：`trivial` 跳过 Phase 1/4/5，但 `0→2`、`2→6` 仍要提案 / 测试 / verify / archive 字段。今天只能靠 Skill 做 gate 补偿；有了 `auto`，状态机可以在 `transition` 里合法补写，并记入 `gatesBypassed`。

全局 `pipeline.confirmation` 作为缺省，Route 覆盖它。单次 change **不允许**再改策略（避免「先 auto 再改回 ask」的审计空洞）；要更严就 `route upgrade`。

### 4.5 状态机才是权威

推荐执行顺序：

```
Agent 即将到达决策点
    │
    ├─► gate-policy.mjs lookup  → {mode, defaultValue}
    │
    ├─ mode=ask  → {{askTool}} → decision/set → transition
    │
    └─ mode=auto → decision/set(default) + record-phase bypass
                   → transition
                       └─ validateGates：字段仍必须存在
                          若 Agent 忘了写，transition 可按策略补写一次
                          并强制写入 gatesBypassed
```

要点：

- **禁止**再引入 `executionMode` 分支或静默 `applyGateInference`。
- `auto` 补写只发生在策略明确列出的 ID 上。
- 向前跳 Phase 时累计检查仍然有效；`auto` 只是「谁来填字段」，不是「可以不填」。
- `tests.status=auto` 只能落到 `skipped`，不能落到 `passed`。

### 4.6 配置落点

优先扩 `openspec/config.yaml#pipeline`（与 Route 同一事实源），解析器用**扁平键**避免嵌套爆炸：

```yaml
pipeline:
  confirmationDefaults:
    proposal-approval: ask
    test-gate: ask
    commit: ask
```

或独立 `openspec/pipeline-confirmation.json`（`JSON.parse` 零依赖，upgrade 时当新 Asset）。不建议写进 `package.json#opsxDevPipeline`：那是 CLI Manifest，不是流水线运行时配置。

`sync` / `upgrade` 必须把默认块 **append 合并**，不能覆盖用户改过的策略（与 `openspec/config.yaml` 现有 writePolicy 同类问题）。

---

## 5. 工作量与影响面（若做 4.x）

| 区域 | 改动 |
| --- | --- |
| `pipeline-lib.mjs` | 解析 / 校验确认策略；未知 ID、非法值、`commit: auto` 直接拒绝 |
| `dev-pipeline-state.mjs` | `transition` 按策略补写；`gatesBypassed` 使用稳定 ID |
| Phase reference + `SKILL.md.hbs` | 每个决策点改为「先查策略」；去掉「不得默认跳过」的绝对句，改为「ask 时不得默认跳过」 |
| 独立 command（propose/apply/archive） | gate 补偿走同一策略，禁止各写一套 |
| `pipeline.yaml.hbs` | 默认策略随三档 Route 发布 |
| 测试 | 在 `test/pipeline/gates.test.ts` 上加策略矩阵；回归「auto 不得写成 passed」 |
| 指标 | 跳过率可按 `gatesBypassed` ID 拆开；需区分「用户当场跳过」与「策略 auto」 |
| 文档 / ADR | 必须新开 ADR，写明与 0002 的关系：不恢复自由阶段表 |

粗估：只做状态机 + 扁平配置 + trivial/standard 默认 auto 补偿，大约一个完整 change；若再开放 commit/push 的 `auto`、模板按 Tool 预渲染、UI 可视化策略，会再翻一倍，且要单独安全评审。

---

## 6. 建议决策

1. **不要做**「全部门禁用户自由开关」。与 ADR 0002 冲突，且会把完整性门禁和 Git 安全门禁暴露给配置。
2. **可以做**「确认策略」：闭集 ID、`ask` \| `auto`、挂在 Route 上、状态机强制补写并审计。
3. **第一版只解决真实痛点**：Route 跳过的 Phase 所留下的累计硬门禁（提案 / 单测 / verify / 归档字段），让 `trivial` / `standard` 不必每次 gate 补偿都问一遍。
4. **commit / push / merge 保持必问**，直到有独立 ADR。
5. Hook、Preflight、乐观锁、事实不一致、冲突解决保持不可配置。

若产品上仍希望「我这个仓库永远不问提案」，用 `standard` + `proposal-approval: auto` 表达，而不是关掉 Phase 1 或绕过 `transition`。

---

## 7. 未决问题（做提案前要拍板）

1. `post-archive-decision: auto` 的默认交付方式是仓库级还是 Route 级？缺省能否禁止 `merge`？
2. 策略变更是否允许作用于已有 in-flight change，还是只作用于新 `init`？
3. `auto` 的单测是 `skipped` 还是允许配置成「静默跑测试，失败再问」？（后者是第三种模式 `run-then-ask`，价值高但不是 skip）
4. 确认策略要不要进 Doctor / 指标看板，作为合规信号？

以上 1–4 不阻塞「是否可行」的判断：可行，但范围必须收在确认策略，而不是全部门禁开关。
