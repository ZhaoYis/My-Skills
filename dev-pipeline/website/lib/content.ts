import {
  Archive,
  Bot,
  Braces,
  ClipboardCheck,
  FileCheck2,
  GitBranch,
  LockKeyhole,
  RefreshCw,
  Rocket,
  SearchCheck,
  ShieldCheck,
  TestTube2,
  Workflow,
} from "lucide-react";

export const navItems = [
  { label: "工作流", href: "#workflow" },
  { label: "核心能力", href: "#state-machine" },
  { label: "安全", href: "#safety" },
  { label: "快速开始", href: "#quick-start" },
  { label: "FAQ", href: "#faq" },
];

export const problems = [
  { index: "01", title: "生成风格割裂", cause: "每个人各凭 prompt 发挥，没有统一的 AI 使用规范。" },
  { index: "02", title: "Review 变成考古", cause: "变更没有 proposal，reviewer 只能从代码 diff 猜意图。" },
  { index: "03", title: "测试覆盖下降", cause: "没有强制门禁，测试对 AI 来说只是建议，不是必须。" },
  { index: "04", title: "决策快速失忆", cause: "设计文档从未更新，关键决定散落在一次性聊天里。" },
  { index: "05", title: "敏感文件入库", cause: "交付前没有自动扫描，.env 与密钥可能混进提交。" },
  { index: "06", title: "口头约定失效", cause: '“下次注意”无法规模化，团队需要工程约束而非记忆。' },
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
    summary: "从正确性、安全、性能、维护性和规范一致性五个维度检查。",
    command: "$ node change-status.mjs --phase review",
    output: ["5 dimensions checked", "0 blocking findings", "review approved"],
    icon: ClipboardCheck,
  },
  {
    number: "4",
    name: "单测",
    english: "Test Gate",
    summary: "执行项目测试；失败则修复重试，最多三轮。",
    command: "$ npm test",
    output: ["backend tests passed", "frontend tests passed", "gate unlocked"],
    icon: TestTube2,
  },
  {
    number: "5",
    name: "归档",
    english: "Archive",
    summary: "把 Delta Specs 合入主规范，让设计决策与代码保持一致。",
    command: "$ node archive.mjs add-todo-due-date",
    output: ["delta spec merged", "change archived", "sensitive scan clear"],
    icon: Archive,
  },
  {
    number: "6",
    name: "交付",
    english: "Merge & Push",
    summary: "逐步确认 commit、push、merge 与 tag，留下完整审计记录。",
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
];

export const specRows = [
  ["输入", "一段话", "proposal + spec + design + tasks"],
  ["AI 理解", '“我觉得你想要……”', '“根据 spec 第 3 条……”'],
  ["验证", "肉眼对比", "openspec validate 自动校验"],
  ["追溯", "Prompt 淹没在聊天里", "完整制品链永久存档"],
  ["恢复", "重新描述一遍", "从 archived change 继续"],
];

export const tools = [
  { name: "Claude Code", key: "CLAUDE", description: "Skill 原生集成，用 /opsx-dev-pipeline 触发全流程。", icon: Bot },
  { name: "Cursor", key: "CURSOR", description: "按需加载项目规则，不打断日常编码，需要时召唤。", icon: Braces },
  { name: "Codex", key: "CODEX", description: "完整 agent 配置，通过 prompt 入口一键启动。", icon: Workflow },
];

export const safetyLines = [
  ["敏感文件扫描", ".env、私钥块与 credentials.json 自动检测并警告"],
  ["危险操作禁用", "拒绝 git add -A、push --force 与 branch -D"],
  ["分步确认", "commit、push、merge、删分支与 tag 各自确认"],
  ["冲突协议", "逐文件解决，禁止全局 --ours / --theirs 覆盖"],
  ["Fast-forward Only", "发现分叉立即暂停，不自动 rebase 或静默覆盖"],
  ["尊重 Git Hooks", "Hook 失败必须修复或显式确认 --no-verify"],
];

export const stats = [
  ["< 30s", "初始化耗时"],
  ["7", "阶段门禁"],
  ["3", "AI 工具"],
  ["2", "技术栈模板"],
  ["10", "自动化脚本"],
  ["MIT", "开源协议"],
];

export const faqs = [
  ["团队成员使用不同 AI 工具，能统一管理吗？", "能。团队共享同一套 OpenSpec 规范、状态机和门禁规则。目前每个项目绑定一个主 AI 工具，混合工具团队可按子项目初始化。"],
  ["需要安装什么？", "需要 Node.js 20+ 和 OpenSpec CLI。安装 OpenSpec 后，一条 npx 命令即可完成初始化。"],
  ["已有项目还能使用吗？", "可以。init 可安装到任意已有项目，默认不覆盖现有文件；.gitignore 等可追加文件会智能合并。"],
  ["适合什么规模？", "个人项目、小团队与开源项目都适用。价值会随协作者数量和变更频率增加而更明显。"],
  ["必须使用 Claude Code 吗？", "不必。Claude Code、Cursor 与 Codex 均受支持，共用同一套流水线逻辑。"],
  ["和直接写 prompt 有什么区别？", "Prompt 只描述当下任务；pipeline 让 prompt 在有 proposal、spec、测试门禁、安全策略和归档规则的系统里运行。"],
  ["7 个 Phase 都是强制的吗？", "审查与单测允许显式跳过，但决定会被记录。提案和归档不可跳过，分别保证目标对齐与变更不失忆。"],
  ["流程跑一半中断怎么办？", "状态保存在 openspec/.pipeline-state。再次触发时会核对 Git 与文件事实，并从断点继续。"],
  ["为什么修复重试最多三轮？", "三轮仍未通过通常意味着需求或设计需要重新判断。状态机会暂停并让人介入，避免 AI 无限循环。"],
  ["可以自定义各阶段行为吗？", "可以。每个 Phase 的行为由 references 下的 Markdown 定义，测试、验证和构建命令可在 openspec/config.yaml 配置。"],
  ["能用于 Vue 或 Django 吗？", "可以从最接近的内置模板开始，再修改项目上下文、规则和 schema。当前预置模板聚焦 React/Vite 与 Spring Boot。"],
  ["前后端项目该选哪个栈？", "初始化时选择主栈，随后可在配置中加入第二套 schema。仓库内 fullstack-todo 样例展示了完整用法。"],
  ["流水线拒绝哪些 Git 操作？", "自动流程禁止全量暂存、强制推送、强制删分支和全局冲突覆盖，并会扫描常见敏感文件。"],
  ["确实需要 force push 怎么办？", "在流水线之外由你手动判断和执行。pipeline 只保证 AI Agent 不会代替你做高风险操作。"],
  ["会上传我的代码吗？", "不会。逻辑与状态均在本地 Git 仓库运行，不需要 API Key，也不会把代码发送到额外服务。"],
  ["和裸用 OpenSpec 有什么区别？", "OpenSpec 提供规范引擎；opsx-dev-pipeline 在其上增加阶段顺序、状态持久化、AI 工具适配和安全交付门禁。"],
  ["和 GitHub Actions 有什么区别？", "CI 在 push 后检查，pipeline 在 AI 编码过程中约束。两者互补，Phase 6 的推送可以继续触发 CI。"],
  ["能替代人工 code review 吗？", "不能。Phase 3 是第一轮自动筛查，让人工 reviewer 把注意力放在架构判断与业务逻辑上。"],
  ["商业使用有限制吗？", "没有。项目使用 MIT 协议，可用于商业项目、私有部署与二次开发。"],
  ["当前路线图是什么？", "重点包括更多 AI 工具适配、社区栈模板，以及继续完善跨平台的 Node.js 脚本体系。"],
  ["遇到问题如何排查？", "先运行 opsx-dev-pipeline doctor --json，再把诊断结果提交到 GitHub Issues。"],
  ["它会拖慢 AI 编码吗？", "它增加的是必要决策点，不是无意义等待。目标是保留 AI 的速度，同时让产出可解释、可验证、可交付。"],
];
