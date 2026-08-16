# Dev-Pipeline 优化方案

## 一、核心优化目标

基于 AI Harness 的优秀设计，Dev-Pipeline 需要在以下方面进行优化：

1. **降低小变更的仪式成本** - 引入风险分级机制
2. **提升配置可追溯性** - 引入有效配置合成
3. **优化知识管理** - 引入两阶段加载
4. **改善状态管理** - 分离机器态与项目事实
5. **增强动态适应能力** - 从静态生成到动态合成

---

## 二、优化方案详解

### 方案 1：引入 Route 分级机制

#### 问题描述
当前所有变更都走完整的 Phase 0-7 流程，即使是 typo 修复也需要经历提案、审查、归档等阶段，仪式成本过高。

#### 借鉴点
AI Harness 的 `route_outcomes` 机制：根据变更风险自动选择不同重量的 workflow 路径。

#### 具体实现

**1.1 在 `openspec/config.yaml` 中增加 route 配置**

```yaml
# openspec/config.yaml
pipeline:
  routes:
    trivial:
      description: "无行为变化的极小变更"
      phases: [0, 2, 6]  # 入口 → 应用 → 提交
      bypass_phases: [1, 3, 4, 5, 7]  # 跳过提案、审查、单测、归档、合并
      examples:
        - typo
        - formatting
        - comment-only
        - import-cleanup
      conditions:
        - "不改变运行时行为"
        - "不改变 API 或配置语义"
        - "不影响多个模块"
    
    standard:
      description: "标准变更"
      phases: [0, 1, 2, 3, 6]  # 入口 → 提案 → 应用 → 审查 → 提交
      bypass_phases: [4, 5, 7]
      examples:
        - 功能开发
        - Bug 修复
        - 重构
    
    full:
      description: "高保障变更"
      phases: [0, 1, 2, 3, 4, 5, 6, 7]  # 完整流程
      examples:
        - 核心业务逻辑变更
        - 数据库迁移
        - 安全相关变更
```

**1.2 在 Phase 0 入口增加 route 评估**

修改 `references/phase-0-entrance.md.hbs`：

```markdown
## Route 评估

在开始流程前，必须评估变更的风险等级并选择合适的 route：

### 评估标准

| Route | 适用场景 | 关键条件 |
|-------|---------|---------|
| `trivial` | typo、格式化、注释 | 不改变运行时行为、不改变 API、不影响多模块 |
| `standard` | 功能开发、Bug 修复、重构 | 目标明确、风险可控、验证路径清晰 |
| `full` | 核心逻辑、数据库、安全 | 高风险、需要完整验证和归档 |

### 决策流程

1. 分析用户需求，判断变更类型
2. 对照评估标准，推荐 route
3. 使用 `{{askTool}}` 让用户确认 route 选择
4. 根据 route 确定需要执行的 phases

### Route 选择命令

```bash
# 记录 route 选择
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<change>" route_choice "trivial"
```

### Phase 执行矩阵

根据 route 自动跳过不需要的 phases：

| Phase | trivial | standard | full |
|-------|---------|----------|------|
| 0 入口 | ✅ | ✅ | ✅ |
| 1 提案 | ❌ | ✅ | ✅ |
| 2 应用 | ✅ | ✅ | ✅ |
| 3 审查 | ❌ | ✅ | ✅ |
| 4 单测 | ❌ | ❌ | ✅ |
| 5 归档 | ❌ | ❌ | ✅ |
| 6 提交 | ✅ | ✅ | ✅ |
| 7 合并 | ❌ | ❌ | ✅ |
```

**1.3 修改状态管理脚本**

在 `dev-pipeline-state.mjs` 中增加 route 支持：

```javascript
// dev-pipeline-state.mjs 新增
function shouldExecutePhase(state, phase) {
  const route = state.decisions?.route_choice || 'standard';
  const routeConfig = {
    trivial: [0, 2, 6],
    standard: [0, 1, 2, 3, 6],
    full: [0, 1, 2, 3, 4, 5, 6, 7]
  };
  return routeConfig[route]?.includes(phase) ?? true;
}

// 在 transition 命令中检查
if (command === 'transition') {
  const phase = parseInt(args[2]);
  if (!shouldExecutePhase(state, phase)) {
    output({ 
      ok: false, 
      reason: 'phase_bypassed_by_route',
      route: state.decisions?.route_choice,
      phase 
    }, 0);
    return;
  }
  // ... 正常 transition 逻辑
}
```

#### 收益
- **typo 修复**：从 7 Phase 减少到 3 Phase，时间从 5 分钟降到 30 秒
- **标准变更**：保持 5 Phase，流程不变
- **高保障变更**：完整 8 Phase，安全性不降低

---

### 方案 2：引入有效配置合成（Effective Config）

#### 问题描述
当前配置在 `init` 时一次性渲染到 `openspec/config.yaml`，无法追溯"这条配置从哪来"，调试困难。

#### 借鉴点
AI Harness 的多层配置级联：包内默认 → 项目事实 → 项目覆写 → 合成有效配置。

#### 具体实现

**2.1 分离配置层次**

```
opsx-dev-pipeline 包内
├── config/defaults.yaml          # 包内默认配置
└── templates/common/config/      # 模板配置

项目内
├── openspec/config.yaml          # 项目事实（人类可维护）
├── openspec/overrides.yaml       # 项目覆写（可选）
└── openspec/.effective-config.yaml  # 合成的有效配置（机器生成，gitignore）
```

**2.2 定义配置层次结构**

```yaml
# config/defaults.yaml（包内默认）
pipeline:
  language: zh
  default_route: standard
  review:
    max_rounds: 3
    auto_fix: false
  tests:
    required: true
    command_auto_detect: true
  git:
    commit_style: conventional
    branch_prefix: feature/

# openspec/config.yaml（项目事实）
pipeline:
  language: zh
  tech_stack: java-spring-boot
  routes:
    standard:
      phases: [0, 1, 2, 3, 6]

# openspec/overrides.yaml（项目覆写）
pipeline:
  review:
    max_rounds: 5  # 覆盖默认的 3
  git:
    branch_prefix: dev/  # 覆盖默认的 feature/
```

**2.3 增加 `config effective` 命令**

在 CLI 中增加配置合成命令：

```typescript
// src/cli/commands/config.ts
export async function configEffective(options: { format: 'yaml' | 'json' }) {
  const defaults = await loadDefaults();
  const projectConfig = await loadProjectConfig();
  const overrides = await loadOverrides();
  
  const effective = deepMerge(defaults, projectConfig, overrides);
  
  // 写入 .effective-config.yaml
  await writeFile(
    'openspec/.effective-config.yaml',
    yaml.stringify(effective)
  );
  
  // 输出带 source 标注的配置
  if (options.format === 'yaml') {
    console.log(yaml.stringify(effective));
  } else {
    console.log(JSON.stringify(effective, null, 2));
  }
}
```

**2.4 在 SKILL.md 中说明配置来源**

```markdown
## 配置说明

当前配置来自三个层次的合成：

1. **包内默认** (`opsx-dev-pipeline/config/defaults.yaml`)
   - 提供所有配置项的默认值
   - 升级时会更新

2. **项目事实** (`openspec/config.yaml`)
   - 人类可维护的项目配置
   - 初始化时生成，后续手动维护

3. **项目覆写** (`openspec/overrides.yaml`)
   - 可选的本地覆写
   - 用于覆盖特定配置项

查看当前有效配置：
```bash
opsx-dev-pipeline config effective
```

查看配置来源：
```bash
opsx-dev-pipeline config effective --explain
```
```

#### 收益
- **可追溯**：每条配置都有 `source` 标注（defaults/project/override）
- **可升级**：包内默认更新后，项目可以选择性采纳
- **可调试**：`config effective --explain` 可以看到每条配置从哪来

---

### 方案 3：引入 Knowledge 两阶段加载

#### 问题描述
当前所有 Phase 的 reference 文档都生成到项目中（`references/phase-*.md`），无论当前 Phase 是否需要，AI 需要自己判断该读哪个。

#### 借鉴点
AI Harness 的 Knowledge 两阶段加载：CLI 基于元数据过滤 → AI 判断是否打开正文。

#### 具体实现

**3.1 为 reference 文档增加元数据**

```markdown
---
# references/phase-1-propose.md
phase: 1
asset_kind: procedure
routes: [standard, full]  # trivial route 不需要
path_hints:
  - "openspec/changes/**/proposal.md"
  - "openspec/changes/**/specs/**"
description: "提案编写阶段的详细指引，包括 proposal/specs/design/tasks 的生成规范"
---

# Phase 1: 提案编写

## 目标
...
```

**3.2 增加 `knowledge select` 命令**

```typescript
// src/cli/commands/knowledge.ts
export async function knowledgeSelect(options: {
  phase: number;
  routes?: string[];
  paths?: string[];
}) {
  const references = await loadReferenceMetadata();
  
  const selected = references.filter(ref => {
    // Phase 过滤
    if (ref.phase !== options.phase) return false;
    
    // Route 过滤
    if (options.routes && !ref.routes.some(r => options.routes!.includes(r))) {
      return false;
    }
    
    // 路径过滤（如果有 path_hints）
    if (ref.path_hints && options.paths) {
      const matched = options.paths.some(p => 
        ref.path_hints.some(hint => globMatch(hint, p))
      );
      if (!matched) return false;
    }
    
    return true;
  });
  
  return {
    selected: selected.map(r => ({
      file: r.file,
      phase: r.phase,
      asset_kind: r.asset_kind,
      description: r.description,
      match_reason: 'phase/route/paths matched'
    })),
    skipped: references.filter(r => !selected.includes(r)).map(r => ({
      file: r.file,
      reason: 'phase/route/paths not matched'
    }))
  };
}
```

**3.3 在 Phase 切换时自动加载 Knowledge**

修改 SKILL.md 的 Phase 切换逻辑：

```markdown
## Phase 切换流程

进入新 Phase 前，执行以下步骤：

1. **阶段迁移**
   ```bash
   node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<change>" <phase> <step>
   ```

2. **加载 Knowledge**
   ```bash
   opsx-dev-pipeline knowledge select --phase <phase> --paths <modified-files>
   ```
   
   输出示例：
   ```yaml
   selected:
     - file: references/phase-2-apply.md
       phase: 2
       asset_kind: procedure
       description: "应用阶段的实施指引"
       match_reason: "phase matched"
   skipped:
     - file: references/phase-1-propose.md
       reason: "phase not matched"
   ```

3. **读取 reference**
   根据 Knowledge 选择结果，读取 `selected` 中的文件正文。

4. **执行 Phase 逻辑**
   按照 reference 中的指引执行当前 Phase 的工作。
```

#### 收益
- **减少噪声**：AI 只看到当前 Phase 需要的 reference
- **路径相关**：如果修改了 Java 文件，可以优先加载 Java 相关的 reference
- **动态适应**：不同 route 加载不同的 Knowledge（trivial 不加载 propose reference）

---

### 方案 4：分离机器态与项目事实

#### 问题描述
当前 `.pipeline-state/` 目录在项目内（`openspec/.pipeline-state/`），需要 gitignore，团队成员之间无法共享流水线状态。

#### 借鉴点
AI Harness 的 `.harness/coding/state/**` 设计：机器态可重建，不入 Git。

#### 具体实现

**4.1 将状态移到机器态目录**

```
项目根
├── openspec/
│   ├── config.yaml              # 项目事实（提交）
│   ├── changes/                 # 变更产物（提交）
│   └── .pipeline-state/         # ❌ 当前位置
│
└── .opsx-dev-pipeline/          # ✅ 新位置（机器态，gitignore）
    └── state/
        └── <change>.json
```

**4.2 修改 .gitignore**

```gitignore
# opsx-dev-pipeline 机器态
.opsx-dev-pipeline/
```

**4.3 修改状态脚本的路径解析**

```javascript
// dev-pipeline-state.mjs
function statePath(root, changeName) {
  // 旧路径（兼容）
  const legacyPath = path.join(root, 'openspec', '.pipeline-state', `${changeName}.json`);
  
  // 新路径
  const newStateRoot = path.join(root, '.opsx-dev-pipeline', 'state');
  const newPath = path.join(newStateRoot, `${changeName}.json`);
  
  // 如果新路径存在，使用新路径
  if (existsSync(newPath)) return newPath;
  
  // 如果旧路径存在，返回旧路径（兼容）
  if (existsSync(legacyPath)) return legacyPath;
  
  // 否则返回新路径（创建时使用）
  return newPath;
}
```

**4.4 增加状态迁移命令**

```bash
# 迁移旧状态到新位置
opsx-dev-pipeline migrate-state

# 输出：
# 迁移状态：
#   openspec/.pipeline-state/add-user-status.json → .opsx-dev-pipeline/state/add-user-status.json
#   openspec/.pipeline-state/fix-login-bug.json → .opsx-dev-pipeline/state/fix-login-bug.json
# 
# 已迁移 2 个状态文件，旧文件已删除。
```

#### 收益
- **Git 历史干净**：机器态不污染 Git 历史
- **可重建**：状态文件可以随时从 OpenSpec 产物重建
- **团队隔离**：每个开发者的机器态独立，不会互相干扰

---

### 方案 5：引入动态 Bundle 注入

#### 问题描述
当前 SKILL.md 在 `init` 时一次性生成，包含所有 Phase 的完整指引。如果 Phase 逻辑需要更新，需要重新 `sync` 或 `upgrade`。

#### 借鉴点
AI Harness 的"薄入口 + 厚 CLI"：SKILL.md 只包含入口决策树，具体指令通过 CLI 动态注入。

#### 具体实现

**5.1 精简 SKILL.md**

```markdown
---
name: opsx-dev-pipeline
description: 执行基于 OpenSpec 和 Git 的门禁式需求开发与交付流程
version: "{{packageVersion}}"
---

# 需求开发全流程流水线

## 入口决策树

```text
IF 用户消息以 "/opsx-dev-pipeline" 开头:
  执行 `opsx-dev-pipeline load --phase <current-phase> --format markdown`
  按输出指引执行
ELSE IF 当前有 active change:
  执行 `opsx-dev-pipeline status`
  展示当前状态，询问是否续接
ELSE:
  执行 `opsx-dev-pipeline start`
  按输出指引进入 Phase 0
```

## 状态协议

- 读取状态：`node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<change>"`
- 阶段迁移：`node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<change>" <phase> <step>`
- 记录决策：`node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<change>" <key> <value>`

## 命令速查

| 命令 | 用途 |
|------|------|
| `opsx-dev-pipeline start` | 新需求入口 |
| `opsx-dev-pipeline load --phase <N>` | 加载 Phase N 的执行指引 |
| `opsx-dev-pipeline status` | 查看当前状态 |
| `opsx-dev-pipeline knowledge select --phase <N>` | 加载 Phase N 的 Knowledge |
```

**5.2 增加 `load` 命令**

```typescript
// src/cli/commands/load.ts
export async function loadPhase(options: {
  phase: number;
  format: 'markdown' | 'json';
}) {
  const state = await loadCurrentState();
  const route = state.decisions?.route_choice || 'standard';
  
  // 检查 phase 是否被 route 跳过
  if (!shouldExecutePhase(state, options.phase)) {
    return {
      skipped: true,
      reason: 'phase_bypassed_by_route',
      route,
      phase: options.phase
    };
  }
  
  // 加载 Phase reference
  const reference = await readFile(
    `references/phase-${options.phase}-*.md`
  );
  
  // 加载 Knowledge
  const knowledge = await knowledgeSelect({
    phase: options.phase,
    routes: [route]
  });
  
  return {
    phase: options.phase,
    reference,
    knowledge,
    state_snapshot: state
  };
}
```

**5.3 在 Phase 切换时动态加载**

```markdown
## Phase 切换流程

进入新 Phase 前：

1. 执行阶段迁移
   ```bash
   node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<change>" <phase> <step>
   ```

2. 加载 Phase bundle
   ```bash
   opsx-dev-pipeline load --phase <phase> --format markdown
   ```

3. 按 bundle 中的指引执行
```

#### 收益
- **动态更新**：Phase 逻辑更新后，不需要重新生成 SKILL.md
- **按需加载**：只加载当前 Phase 需要的指引
- **减少 SKILL.md 体积**：从 500+ 行减少到 50 行左右

---

## 三、实施优先级

| 方案 | 优先级 | 工作量 | 收益 |
|------|-------|-------|------|
| Route 分级 | **P0** | 中 | 直接解决小变更仪式成本高的问题 |
| 分离机器态 | **P0** | 低 | 改善 Git 历史，工作量小 |
| 有效配置合成 | P1 | 高 | 提升可追溯性，但需要重构配置系统 |
| Knowledge 两阶段 | P1 | 中 | 减少噪声，提升 AI 效率 |
| 动态 Bundle | P2 | 高 | 需要重构 SKILL.md 和 CLI，工作量大 |

---

## 四、总结

通过借鉴 AI Harness 的设计，Dev-Pipeline 可以在以下方面获得显著提升：

1. **Route 分级**：让 typo 修复等小变更快速完成，降低仪式成本
2. **有效配置合成**：让配置可追溯、可升级、可调试
3. **Knowledge 两阶段**：让 AI 只看到当前需要的知识，减少噪声
4. **分离机器态**：让 Git 历史干净，状态可重建
5. **动态 Bundle**：让 Phase 逻辑可以动态更新，不需要重新生成

这些优化可以让 Dev-Pipeline 在保持"简单直接"优势的同时，获得更好的灵活性和可维护性。

---

## 附录：参考资源

- AI Harness 项目：`/Users/zhaoyi/Workspace/JavaWorkspace/ai-proj/yzw-ai-framework`
- AI Harness 核心设计：
  - 有效配置合成：`modules/core/src/runtime/effective/build.js`
  - Knowledge 选择器：`modules/core/src/runtime/knowledge-selector.js`
  - Stage 状态机：`modules/coding-harness/runtime/default/harness-core/config/workflow.yaml`
- Dev-Pipeline 项目：`/Users/zhaoyi/Workspace/LLM/My-Skills/dev-pipeline`
