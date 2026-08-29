import {
  Archive,
  BookX,
  Bot,
  BotOff,
  Braces,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileCheck2,
  FileKey,
  FileQuestion,
  GitBranch,
  LockKeyhole,
  OctagonAlert,
  Puzzle,
  RefreshCw,
  Rocket,
  SearchCheck,
  ShieldCheck,
  TestTube2,
  Unlink,
  Workflow,
  Clock,
  Link2,
  UserCheck,
  Layers,
  AlertTriangle,
  Boxes,
  ShieldAlert,
  Sparkles,
  Wrench,
  Code2,
  Server,
  Globe,
  Package,
  Terminal,
  Cpu,
  Database,
} from "lucide-react";

export const navItems = [
  { label: "工作流", href: "#workflow" },
  { label: "核心能力", href: "#state-machine" },
  { label: "对抗验证", href: "#adversarial-review" },
  { label: "多工具", href: "#multi-tool" },
  { label: "Route 分级", href: "#routes" },
  { label: "安全钩子", href: "#hooks" },
  { label: "安全", href: "#safety" },
  { label: "快速开始", href: "#quick-start" },
  { label: "FAQ", href: "#faq" },
];

export const problems = [
  {
    index: "01",
    title: "Agent 自主失控",
    cause: "Agent 自己写代码、调试、部署，决策速度远超人类 review 能力。",
    icon: BotOff,
  },
  {
    index: "02",
    title: "交互黑箱",
    cause: "Agent 之间的交互你根本看不到，不知道它们做了什么决定。",
    icon: EyeOff,
  },
  {
    index: "03",
    title: "Review 变成猜测",
    cause: "变更没有 proposal，reviewer 只能从代码 diff 猜意图。",
    icon: FileQuestion,
  },
  {
    index: "04",
    title: "决策链断裂",
    cause: "三个月前的变更没有一条完整记录，为什么这样写没人知道。",
    icon: Unlink,
  },
  {
    index: "05",
    title: "敏感文件漏网",
    cause: "Agent 把 .env 提交了，安全扫描没拦住，规则对 Agent 不起作用。",
    icon: FileKey,
  },
  {
    index: "06",
    title: "规则形同虚设",
    cause: '"下次设个规则"→ 下次换了个 Agent，规则没用上。口头约定无法规模化。',
    icon: BookX,
  },
  {
    index: "07",
    title: "工具碎片化",
    cause: "团队一半人用 Claude Code、一半用 Cursor，脚本、门禁、命名约定全部割裂。",
    icon: Puzzle,
  },
  {
    index: "08",
    title: "危险命令被默许",
    cause: "Agent 顺手 rm -rf、push --force、chmod 777——prompt 写了也拦不住。",
    icon: OctagonAlert,
  },
];

export const phases = [
  {
    number: "0",
    name: "预检",
    english: "Preflight",
    summary: "确认 OpenSpec、Git、Manifest 与 Route 选择均可用。",
    command: "$ node preflight.mjs --json",
    output: ["openspec 1.7+", "git repository clean", "route: standard"],
    icon: SearchCheck,
  },
  {
    number: "1",
    name: "提案",
    english: "Propose",
    summary: "生成 Why、What、How 与可执行任务清单，等待你确认。",
    command: "$ openspec new change add-todo-due-date",
    output: ["proposal.md", "spec.md", "design.md", "tasks.md"],
    icon: FileCheck2,
  },
  {
    number: "2",
    name: "实施",
    english: "Apply",
    summary: "AI 依据 tasks.md 逐项修改前后端，并实时勾选进度。",
    command: "$ node instructions-apply.mjs add-todo-due-date",
    output: ["Todo model + dueDate", "API schema updated", "DatePicker connected"],
    icon: Braces,
  },
  {
    number: "3",
    name: "审查",
    english: "Review",
    summary: "独立子Agent 盲审代码——安全/正确性/规范三维度，争议自动升级裁决。",
    command: "$ node review.mjs --blind --strategy adversarial",
    output: ["3 dimensions checked", "0 blocking findings", "adversarial review passed"],
    icon: Eye,
  },
  {
    number: "4",
    name: "单测",
    english: "Test Gate",
    summary: "主Agent 写测试，子Agent 审查测试覆盖充分性，互为校验。",
    command: "$ npm test",
    output: ["backend tests passed", "frontend tests passed", "test coverage reviewed"],
    icon: TestTube2,
  },
  {
    number: "5",
    name: "归档",
    english: "Archive",
    summary: "把 Delta Specs 合入主规范，记录完整身份链与阶段耗时。",
    command: "$ node archive.mjs add-todo-due-date",
    output: ["delta spec merged", "identity chain recorded", "change archived"],
    icon: Archive,
  },
  {
    number: "6",
    name: "交付",
    english: "Merge & Push",
    summary: "逐步确认 commit、push、merge 与 tag，敏感文件由 PreToolUse 钩子兜底。",
    command: "$ git push origin feature/add-due-date",
    output: ["source pushed", "main fast-forwarded", "pipeline complete"],
    icon: Rocket,
  },
];

export const stateCapabilities = [
  { title: "门禁校验", text: "测试未通过，状态机拒绝进入归档。", icon: LockKeyhole },
  { title: "状态持久化", text: "流程中断后，精确回到上一个决策点。", icon: RefreshCw },
  { title: "原子写入", text: "临时文件加 rename，崩溃不留下半份状态。", icon: ShieldCheck },
  { title: "重试上限", text: "三轮仍未通过则暂停，主动呼叫人工介入。", icon: Workflow },
  { title: "决策审计", text: "跳过、合并策略与关键确认永久可追溯。", icon: ClipboardCheck },
  { title: "事实校验", text: "恢复时交叉核对 Git、文件系统与 OpenSpec。", icon: GitBranch },
  { title: "身份追溯", text: "git config + 机器指纹 + 时间戳 —— 完整身份链。", icon: UserCheck },
  { title: "阶段耗时", text: "每个 Phase 的开始/结束时间精确记录，定位瓶颈。", icon: Clock },
  { title: "需求关联", text: "关联 JIRA/外部需求 ID，代码变更有业务上下文。", icon: Link2 },
  { title: "混合执行", text: "独立命令与 pipeline 混合使用，状态自动对齐。", icon: Layers },
  { title: "并发控制", text: "多 Agent 操作时乐观锁检测冲突，拒绝覆盖。", icon: AlertTriangle },
  { title: "多工具追踪", text: "manifest.tools 记录每个工具的资产归属，sync/upgrade 逐个刷新。", icon: Boxes },
];

export const specRows = [
  ["输入", "一段话", "proposal + spec + design + tasks"],
  ["AI 理解", '"我觉得你想要……"', '"根据 spec 第 3 条……"'],
  ["验证", "肉眼对比", "openspec validate 自动校验"],
  ["追溯", "Prompt 淹没在聊天里", "完整制品链永久存档"],
  ["恢复", "重新描述一遍", "从 archived change 继续"],
];

export const tools = [
  {
    name: "Claude Code",
    key: "推荐",
    hook: "auto",
    description:
      "Skill 原生集成，Agent 架构天然支持独立子Agent 对抗验证，PreToolUse 钩子自动写入 settings.json。",
    icon: Bot,
  },
  {
    name: "OpenCode",
    key: "AUTO HOOKS",
    hook: "auto",
    description:
      "与 Claude Code 同级的 4 号工具适配器，PreToolUse 钩子由 opsx 自动注入 opencode.json。",
    icon: Wrench,
  },
  {
    name: "Cursor",
    key: "MANUAL",
    hook: "manual",
    description:
      "按需加载项目规则，不打断日常编码；hooks.json 由你按文档手写一份。",
    icon: Braces,
  },
  {
    name: "Codex",
    key: "MANUAL",
    hook: "manual",
    description:
      "完整 agent 配置，通过 prompt 入口一键启动；Codex hook 仍属 feature flag，按文档手动接入。",
    icon: Workflow,
  },
];

export const safetyLines = [
  ["敏感文件扫描", ".env、私钥块与 credentials.json 自动检测并警告"],
  ["危险操作禁用", "拒绝 git add -A、push --force 与 branch -D"],
  ["分步确认", "commit、push、merge、删分支与 tag 各自确认"],
  ["冲突协议", "逐文件解决，禁止全局 --ours / --theirs 覆盖"],
  ["Fast-forward Only", "发现分叉立即暂停，不自动 rebase 或静默覆盖"],
  ["尊重 Git Hooks", "Hook 失败必须修复或显式确认 --no-verify"],
];

export const adversarialPrinciples = [
  { title: "盲审", sub: "Blind Review", desc: "子Agent 只收到 raw diff + 项目规范原文，不收到主Agent 的任何评价。" },
  { title: "独立身份", sub: "Independent Identity", desc: "提示词明确 'You did NOT write this code. The author is someone else.'" },
  { title: "结构化输出", sub: "Structured Output", desc: "子Agent 返回 JSON findings，主Agent 可以验证但不能软处理或删除。" },
];

export const adversarialStrategies = [
  {
    name: "策略 A（默认）— 单Agent 综合审查",
    steps: "主Agent 写代码 → 1 个子Agent 盲审（正确性/安全/性能/可维护性/规范一致性）→ 有争议 → 升级到第二个独立子Agent 裁决 → 两个子Agent 意见一致 → 按有问题处理，主Agent 不得推翻",
  },
  {
    name: "策略 B（高风险触发）— 3Agent 并行审查",
    steps: "认证/授权/支付/敏感数据/加密领域 → 3 个子Agent 并行：安全审计 + 正确性审查 + 规范审查 → 投票机制：≥2 票认为有问题 → 按有问题处理",
  },
];

export const multiToolScenarios = [
  {
    title: "团队混用，但门禁统一",
    body: "Claude Code 用户和 Cursor 用户在同一仓库里写代码，OpenSpec schema、状态机、Hook 脚本共用同一份。",
  },
  {
    title: "重复 init 不再覆盖",
    body: "已经 init 过 Claude Code，再 init OpenCode 不会覆盖前者资产；manifest.tools 会同步记录 [\"claude\", \"opencode\"]。",
  },
  {
    title: "按工具卸载",
    body: "opsx-dev-pipeline uninstall --tool cursor 只删 .cursor 下的托管文件，Claude Code 的 skills/commands 保持原样。",
  },
  {
    title: "升级同步所有工具",
    body: "sync/upgrade 遍历 manifest.tools 中的每个 ID，逐个重新渲染受管文件，多工具资产同步刷新。",
  },
];

export const multiToolRows = [
  ["init --tool claude", "claude", "安装 Claude Code 资产"],
  ["init --tool opencode", "claude, opencode", "补装 OpenCode，不覆盖前者"],
  ["doctor --json", "tools: [claude, opencode], active: claude", "诊断时列出全部已装工具"],
  ["uninstall --tool cursor", "claude, opencode", "按工具粒度卸载"],
];

export const routeDefinitions = [
  {
    id: "trivial",
    label: "琐碎",
    phases: "Phase 0 → 2 → 6",
    use: "错别字、格式化、注释、import 清理",
    upgrade: "可向上升级到 standard / full",
    icon: Sparkles,
  },
  {
    id: "standard",
    label: "标准",
    phases: "Phase 0 → 1 → 2 → 5 → 6",
    use: "新功能、Bug 修复、重构",
    upgrade: "可向上升级到 full",
    icon: Wrench,
  },
  {
    id: "full",
    label: "完整",
    phases: "Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7",
    use: "核心业务、数据库迁移、安全相关",
    upgrade: "顶级 Route，不可降级",
    icon: ShieldAlert,
  },
];

export const hookRules = [
  { name: "block-dangerous-bash.sh", purpose: "危险 Bash", mode: "auto" },
  { name: "block-sensitive-write.sh", purpose: "敏感文件写入", mode: "auto" },
];

export const hookBlocks = [
  { pattern: "rm -rf /、rm -rf ~、rm -rf .", reason: "destructive-rm-blocked" },
  { pattern: "git push --force / --force-with-lease", reason: "force-push-blocked" },
  { pattern: "git branch -D", reason: "force-branch-delete-blocked" },
  { pattern: "chmod 777 / chmod -R 777", reason: "world-writable-chmod-blocked" },
  { pattern: "curl <url> | sh、wget <url> | bash", reason: "remote-pipe-shell-blocked" },
  { pattern: "mkfs.ext4 /dev/sda1", reason: "filesystem-format-blocked" },
  { pattern: "dd if=/dev/zero of=/dev/sda", reason: "raw-disk-write-blocked" },
];

export const hookSensitive = [
  { pattern: ".env / .env.* / *.env", reason: "sensitive-env-blocked" },
  { pattern: "*.key / *.pem / *.p12 / *.pfx / *.secret", reason: "sensitive-key-blocked" },
  { pattern: "credentials.json / service-account.json", reason: "sensitive-credentials-blocked" },
  { pattern: "openspec/.pipeline-state/*.json", reason: "pipeline-state-write-blocked（请用 dev-pipeline-state.mjs）" },
  { pattern: ".git/ 内部文件", reason: "git-internal-write-blocked" },
];

export const hookAdoption = [
  { tool: "Claude Code", mode: "auto", artifact: ".claude/settings.json + scripts/hooks/" },
  { tool: "OpenCode", mode: "auto", artifact: ".opencode/opencode.json + scripts/hooks/" },
  { tool: "Cursor", mode: "manual", artifact: "按 docs/hooks/cursor.md 手写 .cursor/hooks.json" },
  { tool: "Codex", mode: "manual", artifact: "按 docs/hooks/codex.md 手写 ~/.codex/config.toml" },
];

export const techStacks = [
  { id: "java-spring-boot", parent: "backend", summary: "Java 17+ / Spring Boot 3.x / Maven+Gradle" },
  { id: "python-fastapi", parent: "backend", summary: "Python 3.10+ / FastAPI / Pydantic / SQLAlchemy / pytest / Ruff / mypy" },
  { id: "react-vite", parent: "frontend", summary: "React 18+ / TypeScript / Vite / Vitest + RTL" },
  { id: "java-react", parent: "fullstack", summary: "Monorepo: Java Spring Boot + React 18+" },
  { id: "python-react", parent: "fullstack", summary: "Monorepo: Python FastAPI + React 18+" },
];

export const stats = [
  ["< 30s", "初始化耗时"],
  ["8", "Phase 0–7 门禁"],
  ["4", "AI 工具适配器"],
  ["5", "tech-stack 模板"],
  ["13", "E2E 测试场景"],
  ["3", "Route 风险等级"],
  ["2", "PreToolUse 钩子"],
  ["MIT", "开源协议"],
];

export const integrations = [
  { label: "OpenSpec", icon: <FileCheck2 aria-hidden="true" /> },
  { label: "Claude Code", icon: <Bot aria-hidden="true" /> },
  { label: "OpenCode", icon: <Wrench aria-hidden="true" /> },
  { label: "Cursor", icon: <Braces aria-hidden="true" /> },
  { label: "Codex", icon: <Workflow aria-hidden="true" /> },
  { label: "React", icon: <Code2 aria-hidden="true" /> },
  { label: "Spring Boot", icon: <Server aria-hidden="true" /> },
  { label: "FastAPI", icon: <Globe aria-hidden="true" /> },
  { label: "Node.js 20+", icon: <Cpu aria-hidden="true" /> },
  { label: "TypeScript", icon: <Terminal aria-hidden="true" /> },
  { label: "Python 3.10+", icon: <Database aria-hidden="true" /> },
  { label: "Java 17+", icon: <Package aria-hidden="true" /> },
];

export const faqs = [
  ["团队成员使用不同 AI 工具，能统一管理吗？", "能。一份 OpenSpec schema、共享状态机和门禁规则。manifest.tools 会同时记录 claude / opencode / cursor / codex 中已安装的若干个；sync / upgrade 都会逐个刷新。"],
  ["需要安装什么？", "需要 Node.js 20+ 和 OpenSpec CLI 1.6+。安装 OpenSpec 后，一条 npx 命令即可完成初始化。"],
  ["已有项目还能使用吗？", "可以。init 可安装到任意已有项目，默认不覆盖现有文件；.gitignore 等可追加文件智能合并，README.md 也会保留你的修改。"],
  ["适合什么规模？", "个人项目、小团队与开源项目都适用。价值会随协作者数量和变更频率增加而更明显。中小型功能开发（< 500 行 diff）最佳适配；大型重构建议拆分为多个小变更；一次性脚本可用 trivial Route。"],
  ["必须使用 Claude Code 吗？", "不必。Claude Code、OpenCode、Cursor 与 Codex 均受支持，共用同一套流水线逻辑。Claude Code 因 Agent 架构天然支持对抗验证，推荐追求最强审查保障的用户使用；OpenCode 同样获得 auto 钩子集成。"],
  ["和直接写 prompt 有什么区别？", "Prompt 只描述当下任务；pipeline 让 prompt 在有 proposal、spec、测试门禁、安全策略、归档规则与 PreToolUse 钩子的系统里运行。"],
  ["8 个 Phase 都是强制的吗？", "审查与单测允许显式跳过，但决定会被记录。提案和归档不可跳过，分别保证目标对齐与变更不失忆。Route 决定哪些阶段被跳过：trivial 跳过 1/3/4/5/7，standard 跳过 3/4/7，full 完整执行。"],
  ["Route 选错了怎么办？能降级吗？", "Route 只能向上升级：`trivial → standard → full`。如果低估了风险，可以用 `dev-pipeline-state.mjs route <change> upgrade <route>` 升档。降级会被拒绝，避免跳过已发生的审查门。"],
  ["流程跑一半中断怎么办？", "状态保存在 openspec/.pipeline-state。再次触发时会核对 Git 与文件事实，并从断点继续。多工具场景下 manifest.tools 同时记录每个工具的状态归属。"],
  ["为什么修复重试最多三轮？", "三轮仍未通过通常意味着需求或设计需要重新判断。状态机会暂停并让人介入，避免 AI 无限循环。"],
  ["可以自定义各阶段行为吗？", "可以。每个 Phase 的行为由 references 下的 Markdown 定义，测试、验证和构建命令可在 openspec/config.yaml 配置。"],
  ["支持 Python / Django / Vue 吗？", "python-fastapi 与 react-vite、python-react 已内置；从最接近的内置模板开始，再修改项目上下文、规则和 schema。Vue 需自行替换 schema 片段。"],
  ["能多装几个 AI 工具吗？", "可以。init 支持重复执行：先 `init --tool claude` 再 `init --tool opencode` 即可叠加工具，manifest.tools 会累积记录。Cursor/Codex 也可按相同模式补装。"],
  ["可以只卸载某一个工具吗？", "可以。`opsx-dev-pipeline uninstall --tool cursor` 只删除 .cursor 下的托管资产；manifest.tools 同步收敛，但其他工具的 skills/commands 不会被影响。"],
  ["PreToolUse 钩子会拦截所有 AI 操作吗？", "钩子只在 Claude Code 与 OpenCode 中自动安装；Cursor 需要按 docs/hooks/cursor.md 手写 .cursor/hooks.json；Codex 0.141+ 需开启 `[features] hooks = true`。钩子纯 Node.js，无外部依赖。"],
  ["会上传我的代码吗？", "不会。逻辑与状态均在本地 Git 仓库运行，不需要 API Key，也不会把代码发送到额外服务。"],
  ["和裸用 OpenSpec 有什么区别？", "OpenSpec 提供规范引擎；opsx-dev-pipeline 在其上增加阶段顺序、状态持久化、AI 工具适配（含多工具组合）、安全钩子与交付门禁。"],
  ["能替代人工 code review 吗？", "不能。子Agent 对抗验证是在人工 review 之前的第一轮自动化交叉验证——让 AI 先相互挑战，把可自动检测的问题消灭在人工 review 之前。"],
  ["商业使用有限制吗？", "没有。项目使用 MIT 协议，可用于商业项目、私有部署与二次开发。"],
  ["遇到问题如何排查？", "先运行 opsx-dev-pipeline doctor --json，它会列出已安装工具、active tool 以及模板版本诊断，再把结果提交到 GitHub Issues。"],
  ["子Agent 对抗验证和普通 AI 审查有什么区别？", "普通 AI 审查是同一个模型审查自己写的代码——存在确认偏差。子Agent 对抗验证启动一个独立 Agent，它有独立的上下文，不知道主Agent 的判断，收到的只是 raw diff 和项目规范原文。它被明确告知\"你没有写这些代码，作者是别人，你的任务是找出问题\"。"],
  ["我用独立命令写了提案，能用 pipeline 继续吗？", "可以。独立命令执行时会自动记录到 .pipeline-state 的 phaseHistory 中。当你后续触发 pipeline 时，Hermes 会检测已有状态，通过 Gate 补偿策略自动对齐——不需要从头开始，也不会丢失之前的决策记录。"],
  ["混合模式下，如果我跳过了一些门禁怎么办？", "Gate 补偿策略分三级处理：① 可推断的 Gate→ 自动通过；② 需重检的 Gate；③ 必须确认的 Gate → 无论如何都会询问你。"],
  ["状态文件能告诉我谁在什么时候做了什么吗？", "能。状态文件包含：创建者身份（git config + 邮箱）、机器环境信息（OS/Node 版本）、需求追溯 ID、唯一指纹、阶段耗时。完整链路：Who → When → Where → Why → What → How → Review → Test。"],
  ["支持英文本地化吗？", "支持。`init --lang en` 会切换模板、prompt、commit message 与面向用户的错误提示，默认仍为 zh。manifest.lang 字段会持久化偏好。"],
];