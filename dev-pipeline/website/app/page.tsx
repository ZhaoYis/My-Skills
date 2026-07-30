import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  FileCode2,
  Github,
  LockKeyhole,
  Minus,
  ShieldCheck,
  Terminal,
  X,
  Users,
  Vote,
  Search,
  Gauge,
} from "lucide-react";
import { CopyCommand } from "@/components/copy-command";
import { PipelineDemo } from "@/components/pipeline-demo";
import { SiteHeader } from "@/components/site-header";
import {
  adversarialPrinciples,
  adversarialStrategies,
  faqs,
  limitations,
  limitationsScale,
  problems,
  safetyLines,
  specRows,
  stateCapabilities,
  stats,
  tools,
} from "@/lib/content";

const installCommand = "npx opsx-dev-pipeline@latest init";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader />
      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="open-source-pill"><CircleDot aria-hidden="true" /> OPEN SOURCE / MIT</div>
              <h1 id="hero-title">让 AI 写出符合团队规范的代码，<span>而不只是能跑的代码。</span></h1>
              <p className="hero-lede">给 Claude Code、Cursor 和 Codex 装上同一套提案、实施、审查、测试与交付门禁。30 秒初始化，独立 Agent 对抗验证，完整链路永久可追溯。</p>
              <div className="hero-actions">
                <a className="button button--primary" href="#quick-start"><Terminal aria-hidden="true" />开始使用<ArrowDown aria-hidden="true" /></a>
                <a className="button button--secondary" href="https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline" target="_blank" rel="noreferrer"><Github aria-hidden="true" />查看源码<ArrowUpRight aria-hidden="true" /></a>
              </div>
              <div className="hero-proof" aria-label="产品特点">
                <span><Check aria-hidden="true" />本地运行</span>
                <span><Check aria-hidden="true" />无 API Key</span>
                <span><Check aria-hidden="true" />Node.js 20+</span>
              </div>
            </div>

            <div className="hero-visual" aria-label="opsx-dev-pipeline 终端流程示例">
              <div className="visual-label"><span>LIVE PIPELINE</span><b>07 / 07</b></div>
              <div className="terminal-window terminal-window--hero">
                <div className="terminal-bar"><span /><span /><span /><b>~/todo-app</b></div>
                <div className="terminal-body">
                  <p className="terminal-command"><span>$</span> npx opsx-dev-pipeline init --tool claude --stack backend --yes</p>
                  <p className="terminal-muted">Initializing team guardrails...</p>
                  <div className="terminal-phases">
                    {[
                      { label: "Preflight", status: "passed" },
                      { label: "Propose", status: "passed" },
                      { label: "Apply", status: "passed" },
                      { label: "Adversarial", status: "failed" },
                      { label: "Re-apply", status: "passed" },
                      { label: "Re-review", status: "passed" },
                      { label: "Deliver", status: "passed" },
                    ].map((item, index) => (
                      <div key={item.label}><span>{item.status === "passed" ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}</span><b>0{index}</b><p>{item.label}</p><small>{item.status}</small></div>
                    ))}
                  </div>
                  <p className="terminal-success"><ShieldCheck aria-hidden="true" />Pipeline complete. 2 blocked, 2 fixed, 0 bypassed.</p>
                </div>
              </div>
              <div className="terminal-caption"><span>WHY</span><ArrowRight aria-hidden="true" /><span>WHAT</span><ArrowRight aria-hidden="true" /><span>HOW</span><ArrowRight aria-hidden="true" /><span>REVIEW</span><ArrowRight aria-hidden="true" /><span>SHIP</span></div>
            </div>
          </div>
          <a className="scroll-cue" href="#problem"><span>看看 Agent 失控从哪里开始</span><ArrowDown aria-hidden="true" /></a>
        </section>

        <section className="problem section" id="problem" aria-labelledby="problem-title">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div><p className="eyebrow">01 / THE PROBLEM</p><h2 id="problem-title">AI Agent 越来越自主，<br />但你管不了它每一步怎么决策。</h2></div>
            </div>
            <div className="problem-grid">
              {problems.map((problem) => (
                <article className="problem-item" key={problem.index}>
                  <span className="problem-index">{problem.index}</span>
                  <AlertTriangle aria-hidden="true" />
                  <h3>{problem.title}</h3>
                  <p>{problem.cause}</p>
                </article>
              ))}
            </div>
            <div className="transformation-line">
              <div><X aria-hidden="true" /><span>AI AGENT 失控</span><strong>快，但不可控</strong></div>
              <ArrowRight aria-hidden="true" />
              <div><Check aria-hidden="true" /><span>OPSX PIPELINE</span><strong>速度可以被验证</strong></div>
            </div>
          </div>
        </section>

        <section className="workflow section section--dark" id="workflow" aria-labelledby="workflow-title">
          <div className="container">
            <div className="section-heading section-heading--inverse">
              <p className="eyebrow">02 / HOW IT WORKS</p>
              <h2 id="workflow-title">7 个阶段，一条流水线。<br />从一句需求到可信交付。</h2>
              <p>每一步都有状态记录，每个关键节点都由你确认。中断后从断点恢复，不是从头开始。</p>
            </div>
            <PipelineDemo />
          </div>
        </section>

        <section className="state-machine section" id="state-machine" aria-labelledby="state-title">
          <div className="container state-layout">
            <div className="state-sticky">
              <p className="eyebrow">03 / CORE POWER</p>
              <h2 id="state-title">统一团队的标准，<br />追溯每一次变更的完整身份。</h2>
              <p>可持久化状态机把团队规范变成每次变更都必须经过的工程事实。创建者、机器指纹、需求关联、阶段耗时——完整身份链永久可追溯。</p>
              <div className="state-file" aria-label="流水线状态文件示例">
                <div><FileCode2 aria-hidden="true" /><span>pipeline-state.json</span><b>saved</b></div>
                <pre>{`{
  "phase": 4,
  "gate": "tests",
  "status": "passed",
  "decisions": 3
}`}</pre>
              </div>
            </div>
            <div className="capability-list">
              {stateCapabilities.map((item, index) => (
                <article key={item.title}>
                  <span>0{index + 1}</span>
                  <item.icon aria-hidden="true" />
                  <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  <Check aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
          <div className="constraint-statement"><div className="container"><LockKeyhole aria-hidden="true" /><p>这不是 AI 的&quot;建议&quot;</p><Minus aria-hidden="true" /><strong>这是工程的&quot;验证&quot;</strong></div></div>
        </section>

        <section className="adversarial section section--dark" id="adversarial-review" aria-labelledby="adversarial-title">
          <div className="container">
            <div className="section-heading section-heading--inverse">
              <p className="eyebrow">04 / ADVERSARIAL REVIEW</p>
              <h2 id="adversarial-title">AI 写的代码，<br />由另一个 AI 独立审查。</h2>
              <p>AI 写代码很快，但它审查自己时有天然的确认偏差。子Agent 对抗验证——独立上下文、盲审、结构化输出，让 AI 互相挑战。</p>
            </div>

            <div className="adversarial-principles">
              {adversarialPrinciples.map((item) => (
                <article key={item.title}>
                  <span className="principle-icon"><Eye aria-hidden="true" /></span>
                  <div>
                    <h3>{item.title}<small> — {item.sub}</small></h3>
                    <p>{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="adversarial-strategies">
              <h3 className="strategies-title">两种审查策略</h3>
              {adversarialStrategies.map((item) => (
                <div className="strategy-card" key={item.name}>
                  <h4>{item.name}</h4>
                  <p>{item.steps}</p>
                </div>
              ))}
            </div>

            <div className="adversarial-dispute">
              <div className="dispute-visual">
                <div className="dispute-flow">
                  <span><Vote aria-hidden="true" />子Agent 发现 finding</span>
                  <ArrowRight aria-hidden="true" />
                  <span><Search aria-hidden="true" />主Agent 验证</span>
                </div>
                <div className="dispute-branches">
                  <div className="dispute-branch"><Check aria-hidden="true" />可自动验证 → 读代码确认事实</div>
                  <div className="dispute-branch"><Users aria-hidden="true" />需判断 → 升级到第二个子Agent</div>
                </div>
                <div className="dispute-result">
                  <p>两个子Agent 一致 → 按有问题处理，主Agent 不得推翻</p>
                  <p>两个子Agent 不一致 → 标记为&quot;需人工判断&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="spec-section section" id="spec-driven" aria-labelledby="spec-title">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div><p className="eyebrow">05 / SPEC-DRIVEN</p><h2 id="spec-title">先对齐&quot;做什么&quot;，<br />再让 AI 决定&quot;怎么做&quot;。</h2></div>
              <p>规范是 AI 与人类之间的合同。AI 按合同交付，你按合同验收，分歧在写代码前就被看见。</p>
            </div>
            <div className="comparison-table" role="table" aria-label="Prompt-Driven 与 Spec-Driven 对比">
              <div className="comparison-row comparison-head" role="row"><span role="columnheader">比较项</span><span role="columnheader">Prompt-Driven</span><span role="columnheader"><Check aria-hidden="true" /> Spec-Driven</span></div>
              {specRows.map(([label, prompt, spec]) => (
                <div className="comparison-row" role="row" key={label}><strong role="cell">{label}</strong><span role="cell">{prompt}</span><span role="cell">{spec}</span></div>
              ))}
            </div>
            <div className="delta-spec">
              <div className="delta-copy"><p className="eyebrow">DELTA SPECS</p><h3>只记录这次改变了什么。</h3><p>新增、修改、移除都有明确语义；归档时自动合入主规范，文档永远与代码同步。</p></div>
              <pre aria-label="Delta Specs 示例"><code><span className="code-added">## ADDED Requirements</span>{`\n### Requirement: Todo 支持到期日\n\n`}<span className="code-modified">## MODIFIED Requirements</span>{`\n### Requirement: Todo 创建接口\n\n`}<span className="code-removed">## REMOVED Requirements</span>{`\n### Requirement: 旧版导出接口`}</code></pre>
            </div>
          </div>
        </section>

        <section className="tools-section section" id="tools" aria-labelledby="tools-title">
          <div className="container">
            <div className="section-heading section-heading--center">
              <p className="eyebrow">06 / AI TOOLS</p><h2 id="tools-title">选你喜欢的 AI 工具。<br />标准不随工具改变。</h2><p>一套模板、一致的门禁逻辑、各自的原生体验。Claude Code 推荐——原生支持子Agent 对抗验证。</p>
            </div>
            <div className="tools-grid">
              {tools.map((tool, index) => (
                <article key={tool.name}>
                  <div><span>0{index + 1}</span><b>{tool.key}</b></div>
                  <tool.icon aria-hidden="true" />
                  <h3>{tool.name}</h3>
                  <p>{tool.description}</p>
                  <small><Check aria-hidden="true" /> ADAPTER READY</small>
                </article>
              ))}
            </div>
            <div className="inline-command"><code>npx opsx-dev-pipeline list-tools</code><CopyCommand command="npx opsx-dev-pipeline list-tools" compact /></div>
          </div>
        </section>

        <section className="safety section section--ink" id="safety" aria-labelledby="safety-title">
          <div className="container safety-layout">
            <div className="safety-copy">
              <p className="eyebrow">07 / SAFETY GATES</p>
              <h2 id="safety-title">交付之前，<br />安全检查不会沉默。</h2>
              <p>高风险操作不会被揉成一个&quot;确认&quot;按钮。每一道防线都给出明确事实、独立决策和可审计记录。</p>
              <div className="safety-badge"><ShieldCheck aria-hidden="true" /><span><b>LOCAL ONLY</b>代码与状态不会上传</span></div>
            </div>
            <div className="safety-list">
              {safetyLines.map(([title, text], index) => (
                <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div><ShieldCheck aria-hidden="true" /></article>
              ))}
            </div>
          </div>
        </section>

        <section className="quick-start section" id="quick-start" aria-labelledby="quick-title">
          <div className="container quick-layout">
            <div className="quick-copy">
              <p className="eyebrow">09 / QUICK START</p>
              <h2 id="quick-title">30 秒，<br />从零到 AI-Ready。</h2>
              <p>前置条件只有 Node.js 20+ 与 OpenSpec CLI。初始化不会覆盖已有文件，支持先预览安装计划。</p>
              <ol className="quick-steps">
                <li><span>1</span><div><b>安装 OpenSpec</b><small>全局安装规范引擎</small></div></li>
                <li><span>2</span><div><b>初始化 Pipeline</b><small>选择 AI 工具与主技术栈</small></div></li>
                <li><span>3</span><div><b>开始首个变更</b><small>从 proposal 开始，而不是从代码开始</small></div></li>
              </ol>
            </div>
            <div className="code-install">
              <div className="code-install-bar"><span>INSTALL.sh</span><CopyCommand command={`npm install -g @fission-ai/openspec@latest\n${installCommand}\n/opsx-dev-pipeline "给 Todo 应用添加 dueDate 字段"`} /></div>
              <div className="code-lines">
                <p><span>01</span><code><i># 安装 OpenSpec CLI</i></code></p>
                <p><span>02</span><code>npm install -g @fission-ai/openspec@latest</code></p>
                <p><span>03</span><code /></p>
                <p><span>04</span><code><i># 初始化团队流水线</i></code></p>
                <p><span>05</span><code>npx opsx-dev-pipeline@latest init </code></p>
                <p><span>06</span><code /></p>
                <p><span>07</span><code><i># 启动第一个变更</i></code></p>
                <p><span>08</span><code>/opsx-dev-pipeline &quot;给 Todo 添加 dueDate&quot;</code></p>
              </div>
              <div className="code-result"><Check aria-hidden="true" /><span>Pipeline initialized</span><b>READY</b></div>
            </div>
          </div>
          <div className="command-modes container" aria-label="支持的安装模式">
            {["交互安装 / init", "静默安装 / --yes", "计划预览 / --dry-run", "健康诊断 / doctor", "模板升级 / upgrade", "清理卸载 / uninstall"].map((mode) => <span key={mode}><Terminal aria-hidden="true" />{mode}</span>)}
          </div>
        </section>

        <section className="numbers" aria-labelledby="numbers-title">
          <div className="container"><h2 className="eyebrow" id="numbers-title">10 / BUILT FOR REAL WORK</h2><div className="stats-grid">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></div>
        </section>

        <section className="faq section" id="faq" aria-labelledby="faq-title">
          <div className="container faq-layout">
            <div className="faq-heading"><p className="eyebrow">11 / FAQ</p><h2 id="faq-title">你可能想问的，<br />都在这里。</h2><p>还有未覆盖的问题？带上 <code>doctor --json</code> 的结果来 GitHub Issues。</p><a href="https://github.com/ZhaoYis/My-Skills/issues" target="_blank" rel="noreferrer">前往 Issues<ArrowUpRight aria-hidden="true" /></a></div>
            <div className="faq-list">
              {faqs.map(([question, answer], index) => (
                <details key={question} open={index === 0}>
                  <summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><ChevronDown aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <div className="cta-grid" aria-hidden="true" />
          <div className="container">
            <p className="eyebrow">READY TO STANDARDIZE?</p>
            <h2 id="cta-title">让团队的 AI 编码从&quot;各凭本事&quot;<br />变成<span>&quot;统一标准&quot;。</span></h2>
            <div className="cta-command"><Terminal aria-hidden="true" /><code>{installCommand}</code><CopyCommand command={installCommand} compact /></div>
            <div className="cta-links"><a className="button button--light" href="https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline" target="_blank" rel="noreferrer"><Github aria-hidden="true" />查看 GitHub<ArrowUpRight aria-hidden="true" /></a><span><Check aria-hidden="true" />开源 MIT</span><span><Check aria-hidden="true" />本地运行</span></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-main"><div><a className="wordmark wordmark--footer" href="#top"><span className="wordmark-mark">op</span><span>opsx/dev-pipeline</span></a><p>让 AI 的每一次变更，都经得起质疑，也经得起追溯。</p></div><div><b>PRODUCT</b><a href="#workflow">工作流</a><a href="#state-machine">状态机</a><a href="#safety">安全门禁</a></div><div><b>RESOURCES</b><a href="https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline" target="_blank" rel="noreferrer">GitHub</a><a href="https://github.com/ZhaoYis/My-Skills/issues" target="_blank" rel="noreferrer">Issues</a><a href="#quick-start">快速开始</a></div></div>
        <div className="container footer-bottom"><span>© 2026 opsx-dev-pipeline</span><span>MIT LICENSE</span><a href="#top">返回顶部 <ArrowUpRight aria-hidden="true" /></a></div>
      </footer>
    </>
  );
}
