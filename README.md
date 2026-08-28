# My-Skills

个人积累的 **AI Skill 集合仓库** —— 把日常工程、写作、协作场景中沉淀下来的
可复用 skill 统一托管在此。每个子目录都是一个独立 skill，可以单独安装到
Claude Code / Cursor / Codex / OpenCode 等 AI 宿主中使用。

> 这里的 **skill** 特指 AI 宿主（Claude Code、Cursor 等）能识别的提示工程
> 包，核心载体是 `SKILL.md` 文件，部分 skill 附带脚本、模板、参考文档。

---

## 仓库结构

```
My-Skills/
├── dev-pipeline/                # 主项目：npm 包 opsx-dev-pipeline
│                                # 初始化 AI 开发工作流的 CLI
│
├── opsx-dev-pipeline/           # Skill：OpenSpec + Git 全流程编排
├── git-code-review/             # Skill：代码审查（基于 git diff）
├── git-commit-push/             # Skill：commit + push 一条龙
├── git-merge-branch/            # Skill：分支合并
├── file-code-review/            # Skill：单文件审查（无 git 上下文）
│
├── html-prototype-design/       # Skill：单文件 HTML 原型设计
├── html-prototype-annotations/  # Skill：原型功能标注
│
├── wechat-article-writer/       # Skill：公众号文章写作
└── wechat-article-publisher/    # Skill：发布到公众号草稿箱
```

---

## Skills 清单

### 🛠️ 开发流程（dev-pipeline 主项目）

| 目录 | 说明 |
| --- | --- |
| [`dev-pipeline/`](./dev-pipeline) | **npm 包 `opsx-dev-pipeline`**：用一条命令把 OpenSpec + AI skill 全套初始化到新项目，支持 Claude Code / Cursor / Codex / OpenCode 四种宿主，包含阶段门禁（Phase 0–7）、三档 Route（trivial / standard / full）、PreToolUse Hooks 等。详见 [dev-pipeline/README.md](./dev-pipeline/README.md)。 |

### 🔁 需求开发与 Git 协作

| Skill | 一句话能力 |
| --- | --- |
| [`opsx-dev-pipeline`](./opsx-dev-pipeline) | OpenSpec + Git 需求开发全流程：提案 → 应用 → 审查 → 单测 → 归档 → 提交 → 合并 |
| [`git-code-review`](./git-code-review) | 基于 git diff 审查当前分支的未提交/已提交变更，生成审查报告 |
| [`git-commit-push`](./git-commit-push) | 提交代码并推送到远程仓库 |
| [`git-merge-branch`](./git-merge-branch) | 把当前分支合并到目标分支（qa / master / develop 等） |
| [`file-code-review`](./file-code-review) | 审查指定文件或代码片段（无需 git 上下文），支持单文件、多文件、粘贴代码块 |

### 🎨 原型设计与标注

| Skill | 一句话能力 |
| --- | --- |
| [`html-prototype-design`](./html-prototype-design) | 单文件 HTML 产品原型端到端设计：向导流、等待页、弹窗、底部状态机、演示开关 |
| [`html-prototype-annotations`](./html-prototype-annotations) | 给单文件 HTML 原型加上数字橙色标记 + 右侧注释面板，方便业务评审 |

### 📝 公众号写作与发布

| Skill | 一句话能力 |
| --- | --- |
| [`wechat-article-writer`](./wechat-article-writer) | 公众号文章自动化写作：选题澄清 → 资料搜索 → 结构化成文 → 爆款标题 → 排版 |
| [`wechat-article-publisher`](./wechat-article-publisher) | 把 Markdown / HTML 发布到微信公众号草稿箱，与 writer 串联形成"写作→发布"闭环 |

---

## 快速开始

### 安装主项目（dev-pipeline）

```bash
npm install -g @fission-ai/openspec@latest
npx opsx-dev-pipeline@latest init
```

之后进入任意项目目录即可用 Claude Code / Cursor / Codex 启动流水线。
完整文档见 [dev-pipeline/README.md](./dev-pipeline/README.md)。

### 安装单个 skill

每个 skill 是**自包含**的文件夹，可以直接拷贝或软链到宿主约定的目录：

| 宿主        | Skill 目录                                |
| ----------- | ----------------------------------------- |
| Claude Code | `.claude/skills/<skill-name>/`            |
| Cursor      | `.cursor/rules/<skill-name>.mdc` 或目录    |
| Codex       | `.agents/skills/<skill-name>/`            |
| OpenCode    | `.opencode/skills/<skill-name>/`          |

> 各宿主的精确路径以官方文档为准。`dev-pipeline` 生成的 manifest 会自动
> 把这些路径写好。

---

## 贡献与约定

- **语言**：所有 skill 文档默认中文；技术名词（Phase / Route / Manifest
  等）保留英文原名，避免中英混用造成歧义。
- **版本**：每个 skill 在 frontmatter `metadata.version` 维护自己的版本号。
- **License**：仓库整体采用 [MIT](./LICENSE)。
- **变更记录**：dev-pipeline 项目的更新日志见
  [dev-pipeline/CHANGELOG.md](./dev-pipeline/CHANGELOG.md)。

---

## License

[MIT](./LICENSE)
