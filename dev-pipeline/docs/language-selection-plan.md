# 安装流水线时添加文档语言选择

## 背景与动机

当前 `opsx-dev-pipeline init` 在安装时会询问用户：项目名称、AI 工具（Claude/Cursor/Codex）、项目栈（Frontend/Backend）。安装后生成的 `openspec/config.yaml` 包含 `context` 和 `rules` 字段，指导 AI 如何理解项目并生成文档。

**问题**：没有全局的语言设置。AI 生成的文档（提案、设计、规格、任务等）语言不统一，有时中文有时英文，取决于 prompt 和上下文。

**目标**：在 `init` 时增加语言选择（中文/英文），写入 `config.yaml` 作为全局配置，后续 AI 在生成所有文档时自动使用指定语言。

---

## 关键决策汇总

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 语言作用范围 | **全部 AI 产出物**：OpenSpec 制品、代码注释、commit message、PR description、README、CLAUDE.md |
| 2 | 模板方案 | **双模板**：`README.md.zh.hbs` / `README.md.en.hbs`，方便后续添加语言 |
| 3 | 命名规范 | **后缀式**：文件名中嵌入语言代码 `.<lang>.hbs` |
| 4 | Phase reference 翻译 | **分阶段**：本次只翻译用户可见产出物，phase reference 后续迭代 |
| 5 | 非交互模式默认值 | **默认 `zh`**，`--lang` 为可选参数 |
| 6 | Schema 制品模板 | **section headers 保持英文**，作为结构标记，AI 自行判断填充内容语言 |
| 7 | config.yaml 表达方式 | **`language` 代码值 + `rules.language` 强约束**，程序可读代码值，AI 读自然语言规则 |
| 8 | sync/upgrade 语言来源 | **双存**：manifest（`package.json` 的 `opsxDevPipeline`）和 `config.yaml` 各存一份 |
| 9 | 模板解析机制 | **优先级回落**：先找 `.<lang>.hbs`，找不到用 fallback `.hbs`，支持渐进式翻译 |
| 10 | 存量项目升级 | **交互式补齐**：检测到缺少 `language` 时提示用户选择，可通过 `--lang` 跳过交互 |
| 11 | 交互模式默认值 | **默认选中 `zh`** |

---

## 设计方案

### 语言选项

- `zh` — 中文
- `en` — English

### 数据流

```
用户选择语言 → InitAnswers.language → templateContext.language → config.yaml (language + rules.language)
                                                                  → manifest (opsxDevPipeline.language)
                                                                  → 模板解析 (.<lang>.hbs → .hbs fallback)
```

### config.yaml 中的表达

```yaml
language: zh
schema: frontend
context: |
  ...
rules:
  language:
    - "ALL documents, specs, proposals, designs, and tasks MUST be written in Chinese (Simplified)"
    - "ALL code comments MUST be written in Chinese"
    - "ALL commit messages MUST be written in Chinese"
    - "ALL PR descriptions and review comments MUST be written in Chinese"
  proposal:
    - ...
  specs:
    - ...
  design:
    - ...
```

### 模板解析优先级

对于每个模板文件，按以下优先级查找：
1. `<filename>.<lang>.hbs` — 匹配当前 language
2. `<filename>.hbs` — 无语言标记的 fallback

这允许渐进式翻译：新增语言时只需添加对应的 `.<lang>.hbs` 文件，未翻译的自动回落。

---

## 实施步骤

### ✅ Step 1: 添加类型定义

**文件**: `src/core/adapters/types.ts`
- 新增 `DocLanguage` 类型: `'en' | 'zh'`

**文件**: `src/core/prompts/types.ts`
- `InitOptions` 新增 `language?: DocLanguage`
- `InitAnswers` 新增 `language: DocLanguage`

### ✅ Step 2: 添加交互式提示

**文件**: `src/core/init/collectInputs.ts`
- 在 stack 选择之后，新增 language 选择 prompt，默认选中 `zh`
- 在 `--yes` 非交互模式下，默认 `zh`，可通过 `--lang` 覆盖
- 返回值中加入 `language`

### ✅ Step 3: 添加 CLI 选项

**文件**: `src/cli/index.ts`
- `init` 命令新增 `--lang <en|zh>` 选项（可选，默认 `zh`）
- `sync`/`upgrade` 命令也支持 `--lang`，用于存量项目补齐

### ✅ Step 4: 传递 language 到模板上下文 + manifest

**文件**: `src/core/init/buildInstallPlan.ts`
- `templateContext` 中新增 `language` 字段
- 实现模板文件语言解析逻辑（`.<lang>.hbs` → `.hbs` fallback）

**文件**: `src/core/init/runInit.ts`
- 确保 `answers.language` 传递到 `buildInstallPlan`

**文件**: `src/core/init/executeInstallPlan.ts`
- 写入 manifest 时包含 `language` 字段

### ✅ Step 5: 更新 config.yaml 模板（双语）

**文件**: `templates/common/config/config.frontend.yaml.hbs`
- 新增 `language: {{language}}`
- 新增 `rules.language` 强约束（基于 `{{language}}` 条件渲染）

**文件**: `templates/common/config/config.backend.yaml.hbs`
- 同上

### ✅ Step 6: 更新用户可见模板（双语）

需要提供 `.zh.hbs` 和 `.en.hbs` 双版本的模板文件：

| 模板 | 新建文件 |
|------|----------|
| CLAUDE.md | `CLAUDE.md.zh.hbs`、`CLAUDE.md.en.hbs` |
| README.md | `README.md.zh.hbs`、`README.md.en.hbs` |
| gitignore | 无需翻译 |

### ✅ Step 7: 更新 SKILL.md 模板

**文件**: `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs`
- 在执行约束中新增语言指令，引用 `config.yaml` 中的 `language` 和 `rules.language`

### ✅ Step 8: sync/upgrade 存量项目语言补齐

**文件**: `src/core/init/collectInputs.ts` 或独立逻辑
- 检测 manifest 和 config.yaml 中缺少 `language` 时，提示用户选择
- 支持 `--lang` 跳过交互

### ✅ Step 9: schema 模板（保持英文 headers）

Schema 制品模板（proposal/design/spec/tasks）的 section headers 保持英文，不做翻译。AI 根据 `config.yaml` 的 `rules.language` 自行判断内容语言。

---

## 涉及的完整文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/core/adapters/types.ts` | 修改 | 新增 `DocLanguage` 类型 |
| `src/core/prompts/types.ts` | 修改 | `InitOptions`/`InitAnswers` 加 `language` |
| `src/core/init/collectInputs.ts` | 修改 | 新增语言选择 prompt + 存量补齐逻辑 |
| `src/cli/index.ts` | 修改 | `init`/`sync`/`upgrade` 新增 `--lang` CLI 选项 |
| `src/core/init/buildInstallPlan.ts` | 修改 | `templateContext` 加 `language` + 模板语言解析 |
| `src/core/init/runInit.ts` | 修改 | 传递 `language` |
| `src/core/init/executeInstallPlan.ts` | 修改 | manifest 写入 `language` |
| `templates/common/config/config.frontend.yaml.hbs` | 修改 | 新增 `language` + `rules.language` |
| `templates/common/config/config.backend.yaml.hbs` | 修改 | 新增 `language` + `rules.language` |
| `templates/tools/claude/overlay/CLAUDE.md.hbs` → `.zh.hbs` / `.en.hbs` | 拆分 | 双语模板 |
| `templates/common/base/README.md.hbs` → `.zh.hbs` / `.en.hbs` | 拆分 | 双语模板 |
| `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | 修改 | 新增语言约束指令 |

---

## 验证方案

1. **构建**: `npm run build`
2. **交互式安装（中文）**: 选择 `zh`，验证 `config.yaml` 包含 `language: zh` + `rules.language` 中文约束，README/CLAUDE.md 为中文
3. **交互式安装（英文）**: 选择 `en`，验证 README/CLAUDE.md 为英文
4. **非交互式安装**: `opsx-dev-pipeline init --yes --stack frontend`（默认 zh），验证生成正确
5. **非交互式安装**: `opsx-dev-pipeline init --yes --stack frontend --lang en`，验证英文
6. **模板回落**: 删除某个 `.zh.hbs` 文件，验证 fallback 到 `.hbs`
7. **存量升级**: 在旧项目运行 `upgrade`，验证提示语言选择
8. **AI 行为验证**: 安装后运行 `/opsx-dev-pipeline` 创建 change，确认所有制品语言正确
9. **现有测试**: `npm test` 全部通过
