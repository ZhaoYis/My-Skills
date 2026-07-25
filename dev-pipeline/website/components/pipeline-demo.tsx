"use client";

import { Check, Pause, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { phases } from "@/lib/content";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches;
}

export function PipelineDemo() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, () => false);
  const isRunning = playing && !reducedMotion && active < phases.length - 1;

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setTimeout(() => setActive((value) => value + 1), 2600);
    return () => window.clearTimeout(timer);
  }, [active, isRunning]);

  function togglePlayback() {
    if (reducedMotion) {
      setActive((value) => (value === phases.length - 1 ? 0 : value + 1));
      return;
    }
    if (active === phases.length - 1) {
      setActive(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  }

  const phase = phases[active];

  return (
    <div className="pipeline-shell">
      <div className="pipeline-topbar">
        <div>
          <span className="live-indicator"><span aria-hidden="true" />真实场景演示</span>
          <p>给 Todo 应用添加 dueDate 字段</p>
        </div>
        <button className="play-control" type="button" onClick={togglePlayback} aria-label={reducedMotion ? "查看下一阶段" : isRunning ? "暂停演示" : active === phases.length - 1 ? "重播演示" : "继续演示"}>
          {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{reducedMotion ? "下一阶段" : isRunning ? "暂停" : active === phases.length - 1 ? "重播" : "继续"}</span>
        </button>
      </div>

      <div className="phase-track" role="tablist" aria-label="流水线阶段">
        {phases.map((item, index) => (
          <button
            key={item.number}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls="phase-panel"
            className={`phase-tab ${index < active ? "is-complete" : ""} ${index === active ? "is-active" : ""}`}
            onClick={() => { setActive(index); setPlaying(false); }}
          >
            <span className="phase-node">{index < active ? <Check aria-hidden="true" /> : item.number}</span>
            <span className="phase-tab-copy"><strong>{item.name}</strong><small>PHASE {item.number}</small></span>
          </button>
        ))}
      </div>

      <div id="phase-panel" className="phase-panel" role="tabpanel" aria-live="polite">
        <div className="phase-description">
          <span className="phase-icon"><phase.icon aria-hidden="true" /></span>
          <p className="eyebrow">PHASE {phase.number} / {phase.english}</p>
          <h3>{phase.name}</h3>
          <p>{phase.summary}</p>
          <div className="decision-line"><Check aria-hidden="true" />状态写入完成，允许进入下一阶段</div>
        </div>
        <div className="terminal-window terminal-window--demo" aria-label={`${phase.name}阶段终端输出`}>
          <div className="terminal-bar"><span /><span /><span /><b>pipeline / add-todo-due-date</b></div>
          <div className="terminal-body">
            <p className="terminal-command">{phase.command}</p>
            {phase.output.map((line, index) => (
              <p className="terminal-output" key={line}><span>{index === phase.output.length - 1 ? "done" : "pass"}</span>{line}</p>
            ))}
            <p className="terminal-cursor"><span>›</span><i aria-hidden="true" /></p>
          </div>
        </div>
      </div>
    </div>
  );
}
