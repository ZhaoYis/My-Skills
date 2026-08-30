"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { multiToolRows, tools } from "@/lib/content";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches;
}

const transcriptLines = [
  {
    label: "manifest.tools",
    value: ["claude"],
    highlight: true,
  },
  {
    label: "after opencode",
    value: ["claude", "opencode"],
    highlight: true,
  },
  {
    label: "after cursor",
    value: ["claude", "opencode", "cursor"],
    highlight: true,
  },
  {
    label: "after uninstall cursor",
    value: ["claude", "opencode"],
    highlight: false,
  },
];

export function MultiToolDemo() {
  const [step, setStep] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    () => false,
  );
  const isRunning = !reducedMotion && step < transcriptLines.length - 1;

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setTimeout(() => setStep((value) => value + 1), 2400);
    return () => window.clearTimeout(timer);
  }, [step, isRunning]);

  const current = transcriptLines[step];

  return (
    <div className="multi-tool-shell" aria-live="polite">
      <div className="multi-tool-summary">
        <p className="eyebrow">MANIFEST 工具追踪</p>
        <h3>同一仓库，多套工具栈并存。</h3>
        <p>
          每次 <code>init</code> 只安装选中工具的资产，<code>sync</code> / <code>upgrade</code> 会按
          <code>manifest.tools</code> 逐个刷新；<code>doctor</code> 会列出全部已装工具与
          <code>active tool</code>。
        </p>
        <ol className="multi-tool-timeline">
          {tools.map((tool, index) => (
            <li key={tool.name} data-active={index <= step ? "true" : "false"}>
              <span>{index + 1}</span>
              <div>
                <b>{tool.name}</b>
                <small>{tool.hook === "auto" ? "PreToolUse 钩子自动注入" : "Hook 需手动接入"}</small>
              </div>
              {index < step ? <small className="multi-tool-state">已托管</small> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="multi-tool-terminal" aria-label="multi-tool init 演示">
        <div className="terminal-bar">
          <span />
          <span />
          <span />
          <b>~/workspace</b>
          <span className="terminal-step">STEP {step + 1} / {transcriptLines.length}</span>
        </div>
        <div className="terminal-body">
          <p className="terminal-command">
            <span>$</span> opsx-dev-pipeline init --tool claude --stack backend --yes
          </p>
          <p className="terminal-output-line">
            <span>render</span> claude skills &amp; commands
          </p>
          <p className="terminal-output-line">
            <span>render</span> settings.json + scripts/hooks/
          </p>
          <p className="terminal-state-line">
            <span>state</span>
            <code>
              {`{ "tools": ${JSON.stringify(current.value)}`}
              {current.highlight ? ", ..." : " }"}
            </code>
          </p>
          {!isRunning && step < transcriptLines.length - 1 ? null : (
            <p className="terminal-output-line">
              <span>{step === transcriptLines.length - 1 ? "ready" : "render"}</span>
              {step === transcriptLines.length - 1
                ? "tools preserved on uninstall"
                : "preparing next tool..."}
            </p>
          )}
          <p className="terminal-cursor">
            <span>›</span>
            <i aria-hidden="true" />
          </p>
        </div>
      </div>

      <table className="multi-tool-table">
        <thead>
          <tr>
            <th scope="col">命令</th>
            <th scope="col">manifest.tools</th>
            <th scope="col">结果</th>
          </tr>
        </thead>
        <tbody>
          {multiToolRows.map((row, index) => (
            <tr key={row[0]} data-active={index <= step ? "true" : "false"}>
              <th scope="row">
                <code>{row[0]}</code>
              </th>
              <td>
                <code>{row[1]}</code>
              </td>
              <td>{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}