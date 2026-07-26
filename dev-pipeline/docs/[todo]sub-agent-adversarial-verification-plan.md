# 方案：opsx-dev-pipeline 子Agent对抗验证

## Context

当前 `opsx-dev-pipeline` 的 Phase 3（代码审查）和 Phase 4（单元测试）由实施代码的**同一主Agent**执行。这造成"自卖自夸"问题——主Agent审查自己写的代码、为自己写的代码编写测试，存在确认偏差（confirmation bias）。

**核心思路**：利用 Claude Code 的 Agent tool 启动独立子Agent执行对抗验证。子Agent拥有独立上下文，不知道主Agent的判断，以"找出问题"为唯一目标。

**适用范围**：Claude Code（Agent tool 可用）。Cursor/Codex 回退到原有直接审查模式，不做伪对抗（角色切换等）。

> 以下设计经 `/grilling` 对抗质询后定稿。关键决策点标记为 **[D-N]**。

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `templates/common/skills/opsx-dev-pipeline/references/sub-agent-review-prompt.md` | **新建** | 子Agent代码审查提示词模板 |
| `templates/common/skills/opsx-dev-pipeline/references/sub-agent-test-review-prompt.md` | **新建** | 子Agent测试充分性审查提示词模板 |
| `templates/common/skills/opsx-dev-pipeline/references/phase-3-review.md` | **修改** | 重构为子Agent对抗审查+回退路径+争议升级+强制自检 |
| `templates/common/skills/opsx-dev-pipeline/references/phase-4-unit-tests.md` | **修改** | 重构为混合模式：主Agent写测试+子Agent审查充分性 |
| `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | **修改** | 新增子Agent约束、工具检测说明、Phase表更新 |
| `templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` | **修改** | `mutablePaths` 新增 `review.mode`、`review.dispute` |
| `templates/common/skills/opsx-dev-pipeline/agents/openai.yaml` | **修改** | 更新接口能力声明 |

## 对抗验证的三条铁律

1. **盲审（Blind Review）**：子Agent只收到 raw diff + 项目规范原文，不收到主Agent任何评价
2. **独立身份（Independent Identity）**：提示词明确 "You did NOT write this code. The author is someone else."
3. **结构化输出（Structured Output）**：子Agent返回 JSON findings，主Agent验证但不软处理

## 关键设计决策（经 Grilling 确认）

| # | 决策 | 结论 |
|---|------|------|
| **[D-1]** | 主Agent如何保证不污染子Agent | **全文引用**：`<PROJECT_STANDARDS>` 和 `<DIFF_CONTENT>` 必须是原始内容全文引用，禁止主Agent做摘要、筛选或重排。模板首行加元指令："You are a messenger. Do not edit, filter, or annotate. Pass raw output." |
| **[D-2]** | 策略A/B切换阈值 | **风险导向**：高风险领域（认证/授权/支付/敏感数据/加密）→ 策略B（3Agent并行）；diff 涉及核心业务逻辑 → 策略B；其他 → 策略A；diff < 50行且非高风险 → 可跳过审查直接进Phase 4 |
| **[D-3]** | Phase 4 子Agent角色 | **混合模式**：主Agent先写测试（利用实现细节知识），子Agent做**测试充分性审查**——输出"未覆盖场景清单"（untested edge cases），主Agent据此补充测试 |
| **[D-4]** | 主Agent与子Agent分歧裁决 | **两级处理**：①可自动验证的finding（硬编码密钥、空指针等）→ 主Agent读代码确认事实，记录"已确认/未复现（附代码截图）"；②需判断的finding（设计问题、race condition等）→ **升级到第二个独立子Agent**做争议审查。两个子Agent意见一致 → 按有问题处理，主Agent不得推翻 |
| **[D-5]** | 修复循环中的上下文传递 | **传递事实，不传递判断**：新子Agent收到上一轮findings（原始）+ 修复摘要（"已修复/用户接受风险"），不收到上轮overall_assessment、争议投票结果、主Agent评价 |
| **[D-6]** | Cursor/Codex回退路径 | **接受落差+文档透明**：不做伪对抗（角色切换等——隔离度为零，给用户虚假安全感）。SKILL.md 明确标注"高级对抗验证仅在 Claude Code 可用，其他工具审查可能存在确认偏差" |
| **[D-7]** | 指令复杂度管理 | **分层设计**：①核心路径（`MUST`）：启动子Agent、验证finding文件存在性、争议升级——强制检查清单；②增强路径（`SHOULD`）：策略B并行、争议二次审查——允许因资源降级；③Step11-C后插入**强制自检清单**（4项），主Agent逐项确认后才能进Step12 |

## Phase 3 重构流程

```
Step9:  加载项目规范（不变）
Step10: 获取 diff（不变）
Step10a: [新] 检测 Agent tool 是否可用
  ├─ 可用 → Step11-A（子Agent对抗审查）
  └─ 不可用 → Step11-B（直接审查回退，标注 ⚠️ 警告）
Step11-A: [新] 子Agent对抗审查
  1. 读取 sub-agent-review-prompt.md 模板
  2. 选择策略（[D-2]）：
     策略 A（单Agent综合）——默认
     策略 B（3Agent并行：安全审计+正确性审查+规范审查）——高风险/核心业务逻辑
     跳过审查 —— diff < 50行且非高风险
  3. 启动子Agent，传入 raw diff + 项目规范原文（[D-1]）
  4. 子Agent返回 JSON findings
  5. 主Agent验证findings（检查文件存在、去重、可自动验证项确认事实）
  6. [D-4] 争议finding → 启动第二个子Agent做二次审查
  7. [D-1] 禁止主Agent软处理或删除子Agent的finding
Step11-A-check: [新] 强制自检清单（[D-7]）
  ☐ 子Agent prompt 中是否包含了我对代码的任何评价？___
  ☐ 我是否验证了所有 critical/important findings 的文件路径？___
  ☐ 是否有任何子Agent finding 被我删除（而非附加注释保留）？___
  ☐ 争议问题是否已启动二次审查或标记为"需人工判断"？___
  任何一项不符合 → 回到对应步骤修正
Step11-B: [新] 直接审查回退（标注 ⚠️ 自我审查偏差）
Step11-C: [新] 保存报告（含审查模式元数据 + 争议裁决记录）
Step12: 决策点3（保持原结构）

修复循环（[D-5]）：
  - 主Agent修复代码
  - 新子Agent收到：上轮findings（原始）+ 修复摘要 + 用户已接受风险清单
  - 新子Agent不收到：上轮overall_assessment、争议投票、主Agent评价
  - 最多3轮，与现有逻辑一致
```

## Phase 4 重构流程（混合模式 [D-3]）

```
Step13: 识别测试命令（不变）
Step14: 决策点4（不变）
子流程 A-1: 主Agent编写测试
  - 主Agent利用实现细节知识编写初始测试
  - 覆盖基本 happy path 和明显边界条件
子流程 A-2: [新] 子Agent测试充分性审查
  1. 读取 sub-agent-test-review-prompt.md 模板
  2. 传入：实现代码 + 主Agent写的测试代码 + 测试框架信息
  3. 子Agent不写测试代码，输出"未覆盖场景清单"：
     - 遗漏的边界条件
     - 遗漏的错误路径
     - 遗漏的状态转换
     - 遗漏的并发场景
  4. 子Agent返回结构化 JSON
子流程 A-3: 主Agent补充测试
  - 根据子Agent的"未覆盖场景清单"补充测试
  - 运行完整测试套件
  - 失败 → AskQuestion：修复代码 / 修复测试 / 跳过并记录技术债务
修复循环：最多3轮，与现有逻辑一致
```

## 新建文件详细设计

### `sub-agent-review-prompt.md`

主Agent读取此文件构建子Agent提示词。核心设计：

**开篇元指令（给主Agent的）**：
```
You are now acting as a MESSENGER. Your task is to pass the following
content to a sub-agent WITHOUT editing, filtering, summarizing, or
annotating. Pass the RAW output of git diff and the RAW content of
project standards files. Do not add your own assessment.
```

**子Agent提示词**：
- Adversarial Framing：`You are an INDEPENDENT code reviewer. You did NOT write this code. The author is someone else. Your sole task: find defects.`
- 审查维度：Security、Correctness、Performance、Maintainability、Standards Compliance
- 输出格式：JSON（`overall_assessment` + `findings[]`，每个 finding 含 dimension/severity/file/line_hint/description/recommendation + 新增 `verifiability: "auto" | "judgment"`）
- Critical Rules：不得赞美代码、不确定时标注 "needs investigation"、可自动验证的问题必须提供具体文件和行号

### `sub-agent-test-review-prompt.md`

主Agent读取此文件构建测试审查子Agent提示词。核心设计：

- Adversarial Framing：`You are reviewing tests written by someone else. Find what they missed.`
- 输入：实现代码 + 主Agent写的测试代码 + 测试框架上下文
- 输出格式：JSON（`untested_scenarios[]`，每个含 category/description/why_important/test_suggestion）
- 类别：Missed Edge Cases、Missed Error Paths、Missed State Transitions、Missed Concurrency Scenarios、Over-tested Implementation Details（应删除的测试）
- Critical Rules：不写测试代码、不修改实现代码、聚焦"遗漏了什么"而非"现有的好不好"

## dev-pipeline-state.mjs 修改

- `mutablePaths` 集合新增 `'review.mode'`、`'review.dispute'`
- `init` 命令初始状态：
  ```javascript
  review: { round: 0, reportPath: null, status: 'pending', mode: null, dispute: null },
  ```

## SKILL.md.hbs 修改

### 新增执行约束

```markdown
- **Sub-Agent Availability**: Phase 3 和 Phase 4 在 Agent tool 可用时（Claude Code）
  必须使用独立子Agent执行对抗验证。主Agent不得假装自己是独立审查者——
  要么使用真正的 Agent tool，要么显式标注回退模式。
  高级对抗验证功能（多Agent并行审查、争议升级）仅在 Claude Code 可用。
  Cursor/Codex 中审查由实施代码的同一Agent执行，可能存在确认偏差。
```

### Phase 引用表追加列

| Phase | 审查模式 |
|-------|---------|
| 3 | Claude Code: 子Agent对抗审查（策略A/B + 争议升级）; 其他: 直接审查+⚠️警告 |
| 4 | Claude Code: 混合模式（主Agent写测试 + 子Agent审查充分性）; 其他: 直接编写 |

### 工具能力说明

在 SKILL_ROOT 段落后追加：
```markdown
**Tool-Specific Capabilities**:
- **Claude Code**: Agent tool 可用 → 完整对抗验证（子Agent审查+争议升级+测试充分性审查）
- **Cursor / Codex**: Agent tool 不可用 → 回退到直接审查模式，报告中标注 ⚠️ 偏差风险
```

## 实施顺序

| 步骤 | 内容 | 风险 |
|------|------|------|
| 1 | `dev-pipeline-state.mjs`: mutablePaths 新增 `review.mode`、`review.dispute` | 低 |
| 2 | 新建 `sub-agent-review-prompt.md`（含 [D-1] 全文引用元指令 + [D-4] verifiability 字段） | 中 |
| 3 | 新建 `sub-agent-test-review-prompt.md`（[D-3] 测试充分性审查） | 中 |
| 4 | 重构 `phase-3-review.md`（[D-2] 风险导向策略 + [D-4] 争议升级 + [D-5] 事实传递 + [D-7] 分层指令+强制自检） | 高 |
| 5 | 重构 `phase-4-unit-tests.md`（[D-3] 混合模式） | 高 |
| 6 | 更新 `SKILL.md.hbs`（约束+工具说明+Phase表 + [D-6] 回退透明） | 低 |
| 7 | 更新 `agents/openai.yaml` | 低 |
| 8 | 全量验证: typecheck + lint + test + test:pipeline + pack:check | 中 |

## 验证方案

1. **模板渲染验证**：`npm run dev -- init --tool claude --stack backend --yes --dir /tmp/test-init`，检查生成的 SKILL.md 和 phase reference 文件
2. **编译检查**：`npm run build && npm run typecheck`
3. **单元测试**：`npm test`（确认 `review.mode`、`review.dispute` 状态字段正常）
4. **Pipeline E2E**：`npm run test:pipeline`
5. **回退路径**：确认 Cursor/Codex 工具在 SKILL_ROOT 中标注了回退说明
6. **打包完整性**：`npm run pack:check`

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 子Agent过于宽松（找不到问题） | [D-2] 高风险领域强制策略B多Agent并行；对抗性提示词 |
| 子Agent幻觉假问题 | [D-4] 可自动验证项主Agent读代码确认；争议升级二次审查 |
| 主Agent在构造 prompt 时污染子Agent | [D-1] 全文引用+元指令约束+[D-7] 强制自检清单第1项 |
| 子Agent过于激进（大量nitpick） | 严重等级分级，minor可在决策点3跳过 |
| 主Agent推翻子Agent的正确finding | [D-4] 争议升级到第二个子Agent，两人一致即确认，主Agent不得推翻 |
| 修复循环中新子Agent重复已讨论的问题 | [D-5] 传递上一轮findings + 修复摘要 + 用户接受清单 |
| 非Claude工具无法受益 | [D-6] 文档透明标注，不做伪对抗给虚假安全感 |
| 指令过于复杂，LLM执行出错 | [D-7] MUST/SHOULD分层 + 强制自检清单 + 检查清单不合格则回到对应步骤 |
