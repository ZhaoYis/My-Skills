import {
  Archive,
  Bot,
  Braces,
  ClipboardCheck,
  Eye,
  FileCheck2,
  GitBranch,
  LockKeyhole,
  RefreshCw,
  Rocket,
  SearchCheck,
  ShieldCheck,
  TestTube2,
  Workflow,
  Clock,
  Fingerprint,
  Link2,
  UserCheck,
  Layers,
  AlertTriangle,
} from "lucide-react";

export const navItems = [
  { label: "工作流", href: "#workflow" },
  { label: "核心能力", href: "#state-machine" },
  { label: "对抗验证", href: "#adversarial-review" },
  { label: "安全", href: "#safety" },
  { label: "诚实边界", href: "#limitations" },
  { label: "快速开始", href: "#quick-start" },
  { label: "FAQ", href: "#faq" },
];

export const problems = [
  { index: "01", title: "Agent 自主失控", cause: "Agent 自己写代码、调试、部署，决策速度远超人类 review 能力。" },
  { index: "02", title: "交互黑箱", cause: "Agent 之间的交互你根本看不到，不知道它们做了什么决定。" },
  { index: "03", title: "Review 变成猜测", cause: "变更没有 proposal，reviewer 只能从代码 diff 猜意图。" },
  { index: "04", title: "决策链断裂", cause: "三个月前的变更没有一条完整记录，为什么这样写没人知道。" },
  { index: "05", title: "敏感文件漏网", cause: "Agent 把 .env 提交了，安全扫描没拦住，规则对 Agent 不起作用。" },
  { index: "06", title: "规则形同虚设", cause: '"下次设个规则"→ 下次换了个 Agent，规则没用上。口头约定无法规模化。' },
];

export const phases = [
  {
    number: "0",
    name: "预检",
    english: "Preflight",
    summary: "确认 OpenSpec、Git 与项目环境均可用。",
    command: "$ node preflight.mjs --json",
    output: ["openspec installed", "git repository clean", "environment ready"],
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
    summary: "逐步确认 commit、push、merge 与 tag，敏感文件自动扫描。",
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
  { title: "身份追溯", text: "git config + 机器指纹 + 时间戳 — 完整身份链。", icon: UserCheck },
  { title: "阶段耗时", text: "每个 Phase 的开始/结束时间精确记录，定位瓶颈。", icon: Clock },
  { title: "需求关联", text: "关联 JIRA/外部需求 ID，代码变更有业务上下文。", icon: Link2 },
  { title: "混合执行", text: "独立命令与 pipeline 混合使用，状态自动对齐。", icon: Layers },
  { title: "并发控制", text: "多 Agent 操作时乐观锁检测冲突，拒绝覆盖。", icon: AlertTriangle },
];

export const specRows = [
  ["输入", "一段话", "proposal + spec + design + tasks"],
  ["AI 理解", '"我觉得你想要……"', '"根据 spec 第 3 条……"'],
  ["验证", "肉眼对比", "openspec validate 自动校验"],
  ["追溯", "Prompt 淹没在聊天里", "完整制品链永久存档"],
  ["恢复", "重新描述一遍", "从 archived change 继续"],
];

export const tools = [
  { name: "Claude Code", key: "推荐", description: "Skill 原生集成，Agent 架构天然支持独立子Agent 对抗验证，审查保障最强。", icon: Bot },
  { name: "Cursor", key: "CURSOR", description: "按需加载项目规则，不打断日常编码，采用直接审查模式并标注审查方式。", icon: Braces },
  { name: "Codex", key: "CODEX", description: "完整 agent 配置，通过 prompt 入口一键启动，采用直接审查模式并标注审查方式。", icon: Workflow },
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

export const limitations = [
  {
    title: "不能替代人工 code review",
    can: "发现硬编码密钥、空指针、注入风险等可自动检测的问题；检查代码是否符合项目规范；验证测试是否覆盖边界情况；交叉验证多维度一致性。",
    cannot: "理解业务逻辑是否正确（\"这个折扣计算策略对吗？\"）；判断架构设计是否合理（\"这个抽象层有意义吗？\"）；评估产品体验（\"这个交互流程用户会困惑吗？\"）；替代团队协作中的知识传递和共识建立。",
  },
];

export const limitationsScale = [
  { scenario: "中小型功能开发（< 500 行 diff）", grade: "✅ 最佳适配" },
  { scenario: "大型重构（> 2000 行 diff）", grade: "⚠️ 建议拆分为多个小变更" },
  { scenario: "一次性脚本/配置修改", grade: "❌ 过度设计，不建议使用" },
  { scenario: "紧急 hotfix", grade: "⚠️ 可用但需跳过部分门禁（需手动确认）" },
];

export const stats = [
  ["< 30s", "初始化耗时"],
  ["7", "阶段门禁"],
  ["3", "AI 工具"],
  ["2", "技术栈模板"],
  ["13", "E2E 测试场景"],
  ["MIT", "开源协议"],
];

export const faqs = [
  ["团队成员使用不同 AI 工具，能统一管理吗？", "能。团队共享同一套 OpenSpec 规范、状态机和门禁规则。目前每个项目绑定一个主 AI 工具，混合工具团队可按子项目初始化。"],
  ["需要安装什么？", "需要 Node.js 20+ 和 OpenSpec CLI。安装 OpenSpec 后，一条 npx 命令即可完成初始化。"],
  ["已有项目还能使用吗？", "可以。init 可安装到任意已有项目，默认不覆盖现有文件；.gitignore 等可追加文件会智能合并。"],
  ["适合什么规模？", "个人项目、小团队与开源项目都适用。价值会随协作者数量和变更频率增加而更明显。中小型功能开发（< 500 行 diff）最佳适配；大型重构建议拆分为多个小变更；一次性脚本不建议使用。"],
  ["必须使用 Claude Code 吗？", "不必。Claude Code、Cursor 与 Codex 均受支持，共用同一套流水线逻辑。Claude Code 因其 Agent 架构天然支持子Agent 对抗验证，推荐追求最强审查保障的用户使用。Cursor 和 Codex 采用直接审查模式，同样执行完整的三维度检查。"],
  ["和直接写 prompt 有什么区别？", "Prompt 只描述当下任务；pipeline 让 prompt 在有 proposal、spec、测试门禁、安全策略和归档规则的系统里运行。"],
  ["7 个 Phase 都是强制的吗？", "审查与单测允许显式跳过，但决定会被记录。提案和归档不可跳过，分别保证目标对齐与变更不失忆。"],
  ["流程跑一半中断怎么办？", "状态保存在 openspec/.pipeline-state。再次触发时会核对 Git 与文件事实，并从断点继续。"],
  ["为什么修复重试最多三轮？", "三轮仍未通过通常意味着需求或设计需要重新判断。状态机会暂停并让人介入，避免 AI 无限循环。"],
  ["可以自定义各阶段行为吗？", "可以。每个 Phase 的行为由 references 下的 Markdown 定义，测试、验证和构建命令可在 openspec/config.yaml 配置。"],
  ["能用于 Vue 或 Django 吗？", "可以从最接近的内置模板开始，再修改项目上下文、规则和 schema。当前预置模板聚焦 React/Vite 与 Spring Boot。"],
  ["会上传我的代码吗？", "不会。逻辑与状态均在本地 Git 仓库运行，不需要 API Key，也不会把代码发送到额外服务。"],
  ["和裸用 OpenSpec 有什么区别？", "OpenSpec 提供规范引擎；opsx-dev-pipeline 在其上增加阶段顺序、状态持久化、AI 工具适配和安全交付门禁。"],
  ["能替代人工 code review 吗？", "不能。子Agent 对抗验证是在人工 review 之前的第一轮自动化交叉验证——让 AI 先相互挑战，把可自动检测的问题消灭在人工 review 之前，让人的时间花在真正需要判断力的地方。"],
  ["商业使用有限制吗？", "没有。项目使用 MIT 协议，可用于商业项目、私有部署与二次开发。"],
  ["遇到问题如何排查？", "先运行 opsx-dev-pipeline doctor --json，再把诊断结果提交到 GitHub Issues。"],
  ["子Agent 对抗验证和普通 AI 审查有什么区别？", "普通 AI 审查是同一个模型审查自己写的代码——存在确认偏差。子Agent 对抗验证启动一个独立 Agent，它有独立的上下文，不知道主Agent 的判断，收到的只是 raw diff 和项目规范原文。它被明确告知\"你没有写这些代码，作者是别人，你的任务是找出问题\"。这类似于医学中的\"第二意见\"（second opinion），但被工程化为一个自动化步骤。"],
  ["我用独立命令写了提案，能用 pipeline 继续吗？", "可以。独立命令执行时会自动记录到 .pipeline-state 的 phaseHistory 中。当你后续触发 pipeline 时，Hermes 会检测已有状态，通过 Gate 补偿策略自动对齐——不需要从头开始，也不会丢失之前的决策记录。"],
  ["混合模式下，如果我跳过了一些门禁怎么办？", "Gate 补偿策略分三级处理：① 可推断的 Gate→ 自动通过；② 需重检的 Gate；③ 必须确认的 Gate → 无论如何都会询问你。"],
  ["状态文件能告诉我谁在什么时候做了什么吗？", "能。状态文件新增了：创建者身份、机器环境信息、需求追溯、指纹、阶段耗时。完整链路：Who → When → Where → Why → What → How → Review → Test。"],
];