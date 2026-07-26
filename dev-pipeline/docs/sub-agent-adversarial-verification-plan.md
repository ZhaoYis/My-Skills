# 方案：opsx-dev-pipeline 子Agent对抗验证

## Context

当前 `opsx-dev-pipeline` 的 Phase 3（代码审查）和 Phase 4（单元测试）由实施代码的**同一主Agent**执行。这造成"自卖自夸"问题——主Agent审查自己写的代码、为自己写的代码编写测试，存在确认偏差（confirmation bias）。

**核心思路**：利用 Claude Code 的 Agent tool 启动独立子Agent执行对抗验证。子Agent拥有独立上下文，不知道主Agent的判断，以"找出问题"为唯一目标。

**适用范围**：Claude Code（Agent tool 可用）。Cursor/Codex 回退到原有直接审查模式。

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `templates/common/skills/opsx-dev-pipeline/references/sub-agent-review-prompt.md` | **新建** | 子Agent代码审查提示词模板 |
| `templates/common/skills/opsx-dev-pipeline/references/sub-agent-test-prompt.md` | **新建** | 子Agent测试编写提示词模板 |
| `templates/common/skills/opsx-dev-pipeline/references/phase-3-review.md` | **修改** | 重构为子Agent对抗审查+回退路径 |
| `templates/common/skills/opsx-dev-pipeline/references/phase-4-unit-tests.md` | **修改** | 重构为子Agent独立编写测试+回退路径 |
| `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | **修改** | 新增子Agent约束、工具检测说明、Phase表更新 |
| `templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` | **修改** | `mutablePaths` 新增 `review.mode` |
| `templates/common/skills/opsx-dev-pipeline/agents/openai.yaml` | **修改** | 更新接口能力声明 |

## 核心设计

### 对抗验证的三条铁律

1. **盲审（Blind Review）**：子Agent只收到 diff + 项目规范，不收到主Agent任何评价
2. **独立身份（Independent Identity）**：提示词明确 "You did NOT write this code. The author is someone else."
3. **结构化输出（Structured Output）**：子Agent返回 JSON findings，主Agent验证后合并

### Phase 3 重构流程

```
Step9:  加载项目规范（不变）
Step10: 获取 diff（不变）
Step10a: [新] 检测 Agent tool 是否可用
  ├─ 可用 → Step11-A（子Agent对抗审查）
  └─ 不可用 → Step11-B（直接审查回退，标注警告）
Step11-A: [新] 子Agent对抗审查
  1. 读取 sub-agent-review-prompt.md 模板
  2. 选择策略：A（单Agent综合）/ B（3Agent并行：安全+正确性+规范）
  3. 启动子Agent，传入 diff + 项目规范
  4. 子Agent返回 JSON findings
  5. 主Agent验证findings（检查文件存在、去重、确认critical/important）
  6. 禁止主Agent软处理或删除子Agent的finding
Step11-B: [新] 直接审查回退（标注 ⚠️ 自我审查偏差）
Step11-C: [新] 保存报告（含审查模式元数据）
Step12: 决策点3（保持原结构，修复后使用全新子Agent重审）
```

### Phase 4 重构流程

```
Step13: 识别测试命令（不变）
Step14: 决策点4（不变）
子流程 A-1: [新] 子Agent独立编写测试
  1. 读取 sub-agent-test-prompt.md 模板
  2. 传入实现代码 + 测试框架信息 + 现有测试风格参考
  3. 提示词强调"写能发现bug的测试"
  4. 子Agent返回 test_files JSON
  5. 主Agent写入测试文件
子流程 A-2: [新] 主Agent执行测试并分析（谁写的不重要，主Agent运行）
子流程 A-3: [新] 修复循环（失败时可选：修复代码 或 重新启动子Agent写测试）
```

### 子Agent异常处理

| 异常 | 处理 |
|------|------|
| 返回非JSON/无法解析 | 重试一次，仍失败→回退直接审查 |
| 超时 | 重试一次（超时翻倍），仍失败→回退 |
| 明显敷衍（全是"建议加注释"） | 用更强对抗语气重试 |
| 报告不存在的文件 | 主Agent验证过滤无效finding |
| 策略B某Agent失败 | 其余正常使用，失败维度回退主Agent |

### 修复循环——保持独立性

每轮修复后重新审查时：
- 使用**全新子Agent**（不复用上轮上下文）
- 新子Agent prompt中**不包含**上轮审查结果
- 最多3轮，与现有逻辑一致

## 新建文件详细设计

### `sub-agent-review-prompt.md`

主Agent读取此文件，替换变量后传给子Agent。核心要点：

- **Adversarial Framing**：`You are an INDEPENDENT code reviewer. You did NOT write this code.`
- **审查维度**：Security、Correctness、Performance、Maintainability、Standards Compliance
- **输出格式**：结构化 JSON（`overall_assessment` + `findings[]`，每个 finding 含 dimension/severity/file/line_hint/description/recommendation）
- **Critical Rules**：不得赞美代码、不得假设代码正确、不确定时标注 "needs investigation"

**策略 B（多Agent并行）**：3个子Agent分别聚焦安全审计、正确性审查、规范审查，结果由主Agent合并去重。

### `sub-agent-test-prompt.md`

主Agent读取此文件，替换变量后传给子Agent。核心要点：

- **Adversarial Framing**：`You are an INDEPENDENT test engineer. Find bugs through testing.`
- **测试焦点**：Happy Path、Edge Cases、Boundary Conditions、Error Paths、State Transitions、Concurrency
- **输出格式**：结构化 JSON（`test_files[]` 含 path/content/description + `test_command` + `coverage_notes`）
- **Critical Rules**：写能让bug暴露的测试、不复制现有测试、不修改实现代码

## SKILL.md.hbs 修改

### 新增执行约束

```markdown
- **Sub-Agent Availability**: Phase 3 和 Phase 4 在 Agent tool 可用时（Claude Code）
  必须使用独立子Agent执行对抗验证。主Agent不得假装自己是独立审查者——
  要么使用真正的 Agent tool，要么显式标注回退模式。
```

### Phase 引用表追加列

| Phase | 审查模式 |
|-------|---------|
| 3 | Claude Code: 子Agent对抗审查; 其他: 直接审查 |
| 4 | Claude Code: 子Agent编写测试; 其他: 直接编写 |

### 新增工具能力说明

在 SKILL_ROOT 段落后追加 Claude Code / Cursor / Codex 的子Agent支持情况说明。

## dev-pipeline-state.mjs 修改

- `mutablePaths` 集合新增 `'review.mode'`
- `init` 命令初始状态 `review` 对象新增 `mode: null`

## 实施顺序

| 步骤 | 内容 | 风险 |
|------|------|------|
| 1 | `dev-pipeline-state.mjs`: mutablePaths 新增 `review.mode` | 低 |
| 2 | 新建 `sub-agent-review-prompt.md` | 中 |
| 3 | 新建 `sub-agent-test-prompt.md` | 中 |
| 4 | 重构 `phase-3-review.md` | 高 |
| 5 | 重构 `phase-4-unit-tests.md` | 高 |
| 6 | 更新 `SKILL.md.hbs`（约束+工具说明+Phase表） | 低 |
| 7 | 更新 `agents/openai.yaml` | 低 |
| 8 | 全量验证: typecheck + lint + test + test:pipeline + pack:check | 中 |

## 验证方案

1. **模板渲染验证**：`npm run dev -- init --tool claude --stack backend --yes --dir /tmp/test-init`，检查生成的 SKILL.md 和 phase reference 文件
2. **编译检查**：`npm run build && npm run typecheck`
3. **单元测试**：`npm test`（确认 `review.mode` 状态字段正常）
4. **Pipeline E2E**：`npm run test:pipeline`
5. **回退路径**：确认 Cursor/Codex 工具在 SKILL_ROOT 中标注了回退说明
6. **打包完整性**：`npm run pack:check`

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 子Agent过于宽松（找不到问题） | 对抗性提示词 + 策略B多Agent并行 |
| 子Agent幻觉假问题 | 主Agent验证每个finding的文件存在性和代码引用 |
| 子Agent过于激进（大量nitpick） | 严重等级分级，minor可在决策点3跳过 |
| 非Claude工具无法受益 | 回退路径显式标注警告，用户知悉偏差风险 |
| 修复循环发散 | 每轮全新子Agent，不保留上轮上下文 |
