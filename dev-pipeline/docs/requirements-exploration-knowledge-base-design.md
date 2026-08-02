# 需求调研与探索知识库设计

> 状态：M0/M1 已实现（经过 grilling 审查）
> 日期：2026-08-02

## 1. 目标与边界

在需求调研和探索阶段，团队会产生大量暂时不适合进入 proposal/spec 的信息：用户反馈、现状观察、代码证据、外部资料、假设、争议和决策。知识库用于保存这些信息，并让后续需求探索可以复用它们。

知识库不替代 OpenSpec：

- OpenSpec change artifacts 是"本次变更要做什么"的正式交付物。
- Knowledge Base 是"我们知道什么、证据是什么、还不确定什么"的可复用上下文。
- Pipeline state 是"流程执行到哪里"的审计数据。

第一阶段目标是可追溯、可审阅、可 Git 协作；不以向量数据库、自动摘要或自动改写正式规格为前置条件。

### 1.1 读者

知识库同时服务于**人**和 **Agent**：

- **人**：通过 `kb search` CLI 或 IDE 浏览，快速了解团队已知事实、约束和决策。
- **Agent**：通过 `index.json`（结构化索引）读取，在 explore/proposal 阶段自动注入相关知识。

两种消费路径完全分开：Agent 不解析终端输出格式，人不需要直接操作 `index.json`。

### 1.2 质量责任

知识库的内容质量由分层责任人共同保障：

| 角色 | 责任 |
|------|------|
| **作者**（`capturedBy`） | 初稿的准确性，提供 Source |
| **Reviewer**（review 时指定） | 确认 `status: confirmed` 前验证事实 |
| **Owner**（`owners` 字段） | 长期维护，响应 stale 警告，更新过时条目 |
| **Agent** | 正确引用，标注知识盲区，不把 draft 当事实 |
| **使用者**（读 proposal 的人） | 在需求确认时检查 Knowledge Coverage 是否合理 |

如果一条 `confirmed` + `confidence: high` 的知识被证明是错的，根因追溯到 reviewer 和 owner，而不是引用它的 Agent。Agent 信任 confirmed 的知识，如同代码信任库函数的文档。

## 2. 核心概念

### 2.1 Knowledge Entry

一个可独立审阅的原子知识单元，表达一个事实、约束、假设、问题或决策。每个 entry 必须能回答"这句话从哪里来、谁确认过、何时可能失效"。

类型（简化设计）：

| type | 含义 | 例子 |
| --- | --- | --- |
| `fact` | 已被证据支持的事实或观察 | 当前登录接口使用 JWT；新用户首次配置页流失率 42%（来源：analytics 2026-07） |
| `constraint` | 不能违反的约束 | 兼容 Java 17 |
| `assumption` | 尚未验证的暂定断言 | 用户会在移动端完成支付 |
| `question` | 尚未解决的问题（以问号结尾或含"是否/能否"） | 是否允许访客下单 |
| `decision` | 已确认的选择及理由 | 选择 PostgreSQL 而不是 MongoDB |

**fact 与 observation 已合并。** 差异不再通过类型区分，而是通过 `confidence` 字段表达可靠性：

- `confidence: high` → 有代码/测试证据 + 已验证
- `confidence: medium` → 有观察数据但未严格验证
- `confidence: low` → 印象、猜测、初步发现（仅限 `draft` 状态）

**assumption 与 question 的判定规则：** question 还没有答案（以问号结尾或包含"是否/能否/什么/怎么"），assumption 有一个暂定的断言但未验证。如果一条知识既是假设又是问题，拆成两条——遵循第 6 节"一个 entry 只表达一个可判定命题"的原子性规则。

### 2.2 Source

证据来源。来源可以是代码文件、命令输出、会议记录、用户原话、工单、URL、截图或测试结果。Knowledge Entry 引用 Source，而不是把来源内容复制进事实中。

Source 的 `reliability` 分层：

| kind | 默认 reliability | 说明 |
|------|-----------------|------|
| `code` / `test` | `high` | 代码不会说谎，但可能被误解 |
| `conversation` / `ticket` | `medium` | 人的陈述可能不准，需要代码/测试 Source 验证 |
| `url` | `medium` | 外部内容可能变化 |

**`kind: conversation` 不能作为 `confidence: high` 的唯一 Source。** 要升级到 `confidence: high`，必须有一个 `kind: code` 或 `kind: test` 的 Source 来验证。

### 2.3 Research Session

一次探索活动的容器，记录目标、参与者、时间、输入和产出。Session 中允许有草稿和未验证内容；只有显式确认的 entry 才进入长期知识库。

**Session 草稿处理：** 未确认的草稿在 session 关闭时自动创建 `status: draft` 的 entry（不分配 KB ID，或分配临时 ID 待 review 确认）。`sessions/` 目录只保留调研过程的叙述和上下文，不承担草稿存储的职责。所有内容统一在 `entries/` 下，用 `status` 区分成熟度。

### 2.4 Scope 与有效性

每条知识都要标记适用范围：`project`、`service:<name>`、`change:<name>` 或 `team`。知识还应有 `status`（`draft`、`confirmed`、`deprecated`、`rejected`）和可选 `validUntil`，避免旧结论被无条件复用。

## 3. 存储方案

采用 Git 版本化的 Markdown + YAML frontmatter，放在项目的 `openspec/knowledge/` 下：

```text
openspec/
  knowledge/
    README.md                 # 约定、受控标签列表、字段和审阅规则
    .schemas/                 # JSON Schema 校验文件
      entry.schema.json
      source.schema.json
      session.schema.json
    _templates/               # 模板文件
      entry.md
      source.md
      session.md
    entries/                  # 原子知识条目（含 draft 和 confirmed）
      KB-0001.md
    sources/                  # 可复用的证据摘要/引用
      SRC-0001.md
    sessions/                 # 调研过程叙述和上下文（不存储草稿）
      2026-08-02-login.md
    index.json                # 可重建索引，Agent 的唯一入口
```

**不设 `decisions/` 目录。** 决策就是一种 entry（`type: decision`），按类型过滤由 `index.json` 的 `byType` 索引承担。多一个目录就多一个"该放哪"的问题——统一存储，按类型过滤。

不把原始私密内容默认提交到仓库。Source 只保存必要摘要、脱敏后的摘录和定位信息；凭据、客户数据和大文件使用外部链接或 `.gitignore` 管理。

`index.json` 是派生文件，包含结构化索引（`byScope`、`byTag`、`byChange`、`byType`）。**Agent 只读 `index.json`，不直接扫描 `entries/` 目录。** `index.json` 在 M0 即创建，由 `kb rebuild` 命令重建。索引损坏或过期时可以由 `rebuild` 重建，不能通过修改索引改变 entry 内容。

## 4. 数据模型

### 4.1 Knowledge Entry

```yaml
id: KB-0001
type: fact
status: confirmed
title: 登录接口使用 JWT
scope:
  - service:auth
  - project
statement: 当前登录接口返回 JWT，客户端在后续请求中通过 Authorization Bearer 传递。
tags:
  domain: auth          # 必选 1 个，受控词表
  feature: [api, jwt]   # 可选 0-3 个，受控词表
confidence: high
owners: [team-auth]
capturedBy: zhangsan
reviewedBy: lisi
createdAt: 2026-08-02T08:00:00Z
updatedAt: 2026-08-02T08:30:00Z
validUntil: null
sources:
  - SRC-0001
relatedChanges:
  - change:login-refresh-token
relatedEntries: []
supersedes: null
supersededBy: null
```

**标签系统：受控词表。**

标签分为三类，在 `README.md` 中维护（不超过 30 个 domain 标签，feature 标签按需扩展）：

- `domain`（必选 1 个）：`auth`、`payment`、`ui`、`data`、`infra`、`deployment`、`testing`
- `feature`（可选 0-3 个）：`api`、`jwt`、`oauth`、`wechat-pay`、`refund`、`checkout` 等
- `auto`（自动生成，不可手动修改）：`has-source`、`has-conflict`、`stale`、`needs-review`

`kb capture` 时校验标签必须在受控列表中，否则拒绝写入并提示可用标签。`kb review` 时可提议新增标签，需 PR 审阅。M0 就引入受控词表，避免自由标签导致召回失败。

**confidence 管理：**

- **初标：** 作者在 `kb capture` 时标注。基于 Source 的 `reliability` 自动建议：有 `code`/`test` Source → 建议 `high`；只有 `url` → 建议 `medium`；没有 Source → 不允许确认。
- **确认：** `kb review` 时 reviewer 可修改。`confirmed` + `confidence: high` 需要至少一个 reviewer 同意。
- **降级：** 超过 90 天未更新的 entry，在搜索结果中自动标注 `stale`。**不自动降级**——stale 是提醒，不是处罚。自动降级会让一条仍然正确的知识不可见。

**supersedes 双向引用：**

- 旧 entry 通过 `supersededBy` 指向新 entry：`supersededBy: KB-0005`
- 新 entry 通过 `supersedes` 指向旧 entry：`supersedes: KB-0001`
- Git 保留历史版本，`supersedes` 表达**语义上的替代关系**——"旧结论被新结论取代"——这是 Git diff 无法自动推断的。双向引用确保从旧 entry 能找到新结论，从新 entry 能看到历史。

正文固定为四段：

```markdown
## Statement

当前登录接口返回 JWT ...

## Rationale / Context

为什么记录它，以及它对需求的影响。

## Evidence

- `src/auth/login.ts:42`
- `curl` 验证结果（已脱敏）

## Open Questions

- access token 的过期时间是否需要调整？
```

### 4.2 Source

```yaml
id: SRC-0001
kind: code
locator: src/auth/login.ts:42
publicLocator: null          # 可选：外部可访问的替代链接
title: 登录接口实现
capturedAt: 2026-08-02T08:00:00Z
capturedBy: zhangsan
reliability: high
contentHash: sha256:abc123... # 对 locator 指向内容的哈希
redaction: none
```

`kind` 可取 `code`、`doc`、`conversation`、`ticket`、`url`、`command`、`test`、`file`。

**`publicLocator`：** 当 `locator` 指向内部系统（Jira、Wiki）时，`publicLocator` 可留空或指向公开摘要。开源场景下通过 `.gitignore` 排除包含内部 URL 的 source 文件。

**`contentHash`：** 对 Source 指向的具体内容做哈希：
- `kind: code` → 对 `locator` 指向的文件内容做哈希
- `kind: url` → 对抓取时的页面内容做哈希
- `kind: command` → 对命令输出做哈希

验证时机：**CI 中定期检查（每日），不在每次 search 时验证。** 哈希不匹配时，自动标记 entry 为 `stale`，提示 reviewer 验证知识是否仍然有效。不自动废弃——内容可能只是格式化变化，结论仍正确。

### 4.3 Research Session

```yaml
id: RS-2026-08-02-login
status: open
goal: 评估 refresh token 改造范围
change: login-refresh-token
participants: [zhangsan, agent]
startedAt: 2026-08-02T07:50:00Z
updatedAt: 2026-08-02T09:10:00Z
entries: [KB-0001, KB-0002]
sources: [SRC-0001, SRC-0002]
unresolvedQuestions: [KB-0003]
```

Session 关闭时记录 `outcome`（`promoted`、`discarded`、`needs-follow-up`）和摘要。关闭不代表其中所有 entry 都已确认——未确认的草稿自动创建 `status: draft` 的 entry，统一存放在 `entries/` 下。

## 5. 与现有流水线的集成

### 5.1 Explore 读取上下文

保留 `/opsx:explore` 的只读性质。在 explore 开头展示紧凑摘要，不打断思路：

```markdown
## 📚 知识库 (3 条相关)
已确认：登录接口使用 JWT | 支付不支持部分退款 | 用户表在 PostgreSQL
假设：用户会在移动端完成支付
冲突：⚠ KB-0003 和 KB-0012 对"退款时效"有不同结论
```

只列标题，不列来源和置信度。用户追问某条细节时再展开。探索阶段需要"快速知道有什么"，而不是"审阅每条知识"。

具体流程：

1. 检查 `openspec/knowledge/index.json` 是否存在。
2. 根据用户问题、change 名称、scope 和 tags，分层读取相关知识。
3. 在 explore 输出中生成候选知识段落，供用户决定是否沉淀。
4. 将探索结果写入响应中的"候选知识"，但不自动写文件、不调用状态修改命令。

没有知识库、索引失效或读取失败时，探索仍可继续，并明确提示"本次未使用知识库"。

### 5.2 显式沉淀

增加独立的 `/opsx:kb`（或等价 skill）用于写入：

- `kb capture`：从手动输入或 explore 候选知识创建 draft entry/source。
  - 手动输入：`kb capture --type fact --title "..." --statement "..." --source SRC-0001`
  - 从 explore：`kb capture --from-explore 3`（把 explore 输出中第 3 条候选知识转为 draft）
  - **Agent 永远不自动调用 `kb capture`**，只能建议"以下内容建议沉淀为知识"，由人手动执行。
- `kb review`：逐条确认、驳回、合并或标记冲突。
- `kb search`：按关键词、scope、type、status、change 查询。
- `kb link`：把 entry 与 change 关联。**只修改 entry 的 `relatedChanges` 字段**，不修改 change 的 pipeline state。在 **Phase 5 归档时自动执行**。
- `kb rebuild`：重建 `index.json`。

写入流程必须显式确认：`生成草稿` 与 `确认写入` 分开。`/opsx:explore` 只能建议调用 `kb capture`，不能替用户确认。

### 5.3 Phase 1 的使用方式

在 Phase 1 Step 3（需求理解确认）前，proposal agent 读取相关知识并在摘要中标出：

```markdown
## Knowledge Coverage

### 已匹配的知识 (3 条)
- [KB-0001] 登录接口使用 JWT (confirmed, high)
- [KB-0007] 支付不支持部分退款 (confirmed, high)
- [KB-0012] 退款时效为 7 天 (confirmed, medium)

### 可能相关的知识 (2 条)
- [KB-0023] 优惠券计算逻辑 (confirmed)

### 已知的知识盲区
- 未找到关于"部分退款"的详细知识，当前方案的退款设计基于假设。
```

关键价值在第三段——agent 发现方案中某个假设没有知识支撑时，必须显式标出，让需求确认时人能发现。

proposal 中不应直接复制全部知识，而应引用 `KB-*`。需求确认后，使用 `kb link` 将正式 proposal 与被采纳的 entry 关联。这样可以追踪"哪条知识导致了哪个需求"。

### 5.4 Change 生命周期

- 新建 change：允许关联已有 entries，不自动创建全局知识。
- 提案被批准：把明确采纳的 draft 标记为 `confirmed`，或保持 change-specific scope。
- 代码审查/验证：发现知识过时时，创建新 entry 并用 `supersedes` 替代旧 entry，不覆盖历史。
- change 归档（Phase 5）：agent 自动调用 `kb link` 更新 entry 的 `relatedChanges`。关联关系在此时确定，而非 proposal 创建时（proposal 可能被拒绝）。

## 6. 冲突与质量规则

知识库的主要风险不是"搜不到"，而是"搜到过时或互相矛盾的结论"。因此需要以下硬规则：

1. **原子性：** 一个 entry 只表达一个可判定命题。**可判定 = 命题可以用一个具体的 Source 验证为真或假。** 如果 statement 包含模糊词（"明显"、"很多"、"经常"），必须量化：❌ "新用户流失明显" → ✅ "新用户首次配置页流失率 42%（来源：analytics 2026-07）"。`kb review` 时检查：模糊词未量化 → 拒绝 `confirmed` 状态。

2. **来源要求：** `confirmed` 必须至少有一个 Source；没有来源只能是 `draft` 或 `assumption`。`kind: conversation` 不能作为 `confidence: high` 的唯一 Source。

3. **冲突检测：**
   - **写入时检测：** `kb capture` 写入 draft 时，自动检查同 scope + 相似 tags 的 confirmed entry 是否存在矛盾命题。检测到则标记 `conflict: [KB-0003]`，提示用户。
   - **CI 定期检测：** 扫描所有 confirmed entry，对 statement 做关键词重叠检测（同 scope + 相反关键词如"支持/不支持"），自动标记候选冲突。
   - **语义检测：** M3 引入 embedding 后实现。不自动选择最新一条——搜索结果必须显示 `conflict`。

4. **版本管理：** 更新结论创建新 entry，并通过双向 `supersedes`/`supersededBy` 关联旧 entry；历史版本由 Git 保留。

5. **可靠性：** 外部资料默认 `reliability: medium`，代码/测试证据默认 `high`，用户假设默认 `low`，均可人工调整。

6. **Owner：** 每个 entry 必须有 owner；长期未更新的 entry（超过 90 天）在搜索结果中显示 stale 警告。

7. **隐私：** 禁止将 secrets、个人敏感信息和未脱敏客户数据写入 source。

## 7. 查询与呈现

### 7.1 MVP 查询顺序

采用**分层召回**策略，过滤是级联缩小范围，不是级联排除：

```javascript
function query({ change, scope, status = "confirmed", tags, keyword }) {
    let results = allEntries;

    if (change)  results = filterByChange(results, change);   // 有就过滤，没有就跳过
    if (scope)   results = filterByScope(results, scope);     // 有就过滤，没有就跳过
    if (status)  results = filterByStatus(results, status);   // 默认 confirmed
    if (tags)    results = filterByTags(results, tags);       // 有就过滤，没有就跳过
    if (keyword) results = filterByKeyword(results, keyword); // 有就过滤，没有就跳过

    return sortByConfidenceAndTime(results);
}
```

**分层展示：**

| 层级 | 匹配方式 | 展示方式 | 数量限制 |
|------|---------|---------|---------|
| 第一层 | change 关联 + scope 精确匹配 | 必定展示，作为"确认知识" | 不限 |
| 第二层 | tags 交集 + 关键词匹配 | 折叠展示，标注"可能相关" | 最多 10 条 |
| 第三层 | 全文搜索 | 手动 `kb search` 触发 | 不限 |

proposal 中只引用第一层作为"确认知识"，第二层作为"参考知识"放在附录。这样 proposal 不会冗长，但也不会漏掉重要线索。

**召回率目标：** 精确匹配 100%（change + scope 过滤），语义扩展 80%+（tags 交集）。剩余 20% 由"知识盲区"声明兜底。

### 7.2 展示格式

**Agent 消费（只读 `index.json`）：**

```json
{
  "entries": {
    "KB-0001": {
      "id": "KB-0001",
      "type": "fact",
      "status": "confirmed",
      "title": "登录接口使用 JWT",
      "scope": ["service:auth"],
      "tags": { "domain": "auth", "feature": ["api", "jwt"] },
      "confidence": "high",
      "updatedAt": "2026-08-02T08:30:00Z",
      "sources": ["SRC-0001"],
      "file": "entries/KB-0001.md"
    }
  },
  "index": {
    "byScope": { "service:auth": ["KB-0001"] },
    "byTag": { "auth": ["KB-0001"], "api": ["KB-0001"] },
    "byChange": { "login-refresh-token": ["KB-0001"] },
    "byType": { "fact": ["KB-0001"], "decision": [] }
  }
}
```

Agent 加载 `index.json`（一个文件，500 条约 200KB），内存过滤，然后按需读取具体 entry 的 Markdown 正文。**永远不解析终端输出格式。**

**人消费（`kb search` 终端输出）：**

```text
[KB-0001] 登录接口使用 JWT  (confirmed, high, updated 2d ago)
适用：service:auth, project
来源：src/auth/login.ts:42, SRC-0001
关联：change/login-refresh-token
```

**性能预估：** 500 条时 index.json 约 200KB，解析 + 过滤 < 50ms。1000 条时约 400KB，仍然可用。在 5000 条之前不需要引入外部索引服务。

## 8. 权限、协作与隐私

- 默认随项目 Git 管理，review entry 像 review 代码一样走 PR。
- `sources/` 可以只提交脱敏摘要，原始录音、截图和客户数据留在受控外部存储。
- `owners` 负责定期复核。

### 8.1 CI 分层检测

| 检测层 | 检测内容 | 方式 |
|--------|---------|------|
| CI（每次 PR） | 格式错误、缺 Source、非法状态、重复 ID | 自动拒绝 |
| CI（每次 PR） | `contentHash` 不匹配 → 标记 stale | 自动警告 |
| CI（每日） | 外部 URL 可访问性检查 | 自动警告 |
| 人工（每季度） | `owners` 复核所有超过 90 天的 entry | 自动提醒 |

- index 是派生物，允许 CI 重建并验证工作树没有未预期差异。
- 不在 pipeline state 中复制 entry 内容，只保存可选的 `knowledgeRefs: [KB-0001]`，避免状态文件膨胀。
- `publicLocator` 字段支持开源场景：内部 URL 保留在 `locator`，外部可访问版本放在 `publicLocator`。

## 9. MVP 分阶段

### M0：约定和手工可用

- 创建目录、README（含受控标签列表）、`_templates/`（entry/source/session 模板）、`.schemas/`（JSON Schema 校验）。
- 创建 `index.json` 和 `kb rebuild` 脚本（手工执行，Node.js 实现，扫描 frontmatter 生成索引）。
- 在 explore 输出中从 `index.json` 读取 confirmed entries（只读）。
- 通过 Git 手工审阅和关联。
- 第一批 entry 来自一个真实 change 的调研反向沉淀，至少 10-15 条，用于验证设计。

### M1：CLI/Skill

- 实现 `kb capture/search/review/link/rebuild`。
- 增加 frontmatter 校验（含受控标签校验）、ID 生成、脱敏检查和冲突提示。
- 在 proposal 生成前自动注入 Knowledge Coverage 段落。
- `kb link` 在 Phase 5 归档时自动执行。

### M2：流水线闭环

- pipeline state 增加 `knowledgeRefs` 和 Phase 1 的引用审计。
- proposal/spec 中生成反向引用。
- CI 检查 stale entries、外链和未解决问题。

### M3：智能检索（可选）

- 本地全文索引或 embedding 召回。
- 基于语义的冲突检测和重复建议。
- 任何自动晋升、废弃或修改仍需人工确认。

## 10. 关键决策

| 决策 | 选择 | 原因 |
| --- | --- | --- |
| 存储 | Git + Markdown/frontmatter | 可审阅、可迁移、符合现有 OpenSpec 资产模式 |
| 事实来源 | Source 与 Entry 分离 | 保留证据链，避免复制和失真 |
| 类型系统 | fact/constraint/assumption/question/decision（5 类） | 合并 fact 和 observation，用 confidence 区分可靠性 |
| 标签 | 受控词表（domain + feature + auto） | 避免自由标签导致召回失败，M0 即引入 |
| 索引 | `index.json` 在 M0 即创建 | Agent 唯一入口，避免扫描目录；5000 条内性能无忧 |
| 版本管理 | 新 entry + 双向 supersedes/supersededBy | 保留历史，避免静默覆盖，双向引用不产生死胡同 |
| Explore 写入 | 禁止隐式写入 | 保持现有 read-only 契约，避免污染长期知识 |
| 状态 | draft/confirmed/deprecated/rejected | 明确不确定性和历史，不把草稿当事实 |
| 检索 | 分层召回（精确 → 语义 → 全文） | 宁可多不可漏，分层展示避免冗长，盲区声明兜底 |
| 变更更新 | 新 entry + supersedes | 保留历史，避免静默覆盖 |
| Pipeline 关联 | 只保存 knowledgeRefs | 状态文件保持小且稳定，内容仍在知识库 |
| `kb link` 时机 | Phase 5 归档时自动执行 | proposal 可能被拒绝，关联关系在归档时确定 |
| CI 检测 | 分层（PR → 每日 → 季度） | 格式问题自动拒绝，过时问题人工判断 |
| 草稿存储 | 统一在 `entries/` 下，用 status 区分 | `sessions/` 只保留叙述上下文 |
| 存储目录 | 不设 `decisions/` 目录 | 统一存储，按 type 过滤由索引承担 |

## 11. 首个实现建议

建议先实现 M0 和 M1 的最小闭环：

1. ✅ 创建 `openspec/knowledge/` 目录结构和文件：
   - `README.md`：约定、受控标签列表、字段说明、审核规则
   - `.schemas/entry.schema.json`、`.schemas/source.schema.json`、`.schemas/session.schema.json`：JSON Schema 校验
   - `_templates/entry.md`、`_templates/source.md`、`_templates/session.md`：模板文件

2. ✅ 实现 `kb rebuild` 脚本（Node.js），扫描 entry frontmatter 生成 `index.json`。

3. ✅ 给 `/opsx:explore` 增加只读的知识检索段落（从 `index.json` 读取）。

4. ✅ 新增 `/opsx:kb` skill，先支持 `capture`、`search`、`review`、`link`。

5. ✅ 在 proposal 中生成 `Knowledge Coverage` 段落和 `KB-*` 引用。

6. ✅ 暂不修改 `dev-pipeline-state.mjs`，等引用在实际使用中稳定后再加入 `knowledgeRefs`。

7. ✅ 第一批 entry 来自一个真实 change 的调研反向沉淀，至少 10-15 条，验证检索、召回和展示流程。

8. ✅ `kb link` 在 Phase 5 归档时自动执行，不在 proposal 创建时自动关联。

这样可以先验证知识条目的粒度、复用率和冲突处理方式，再决定是否值得引入索引服务或更复杂的自动化。
