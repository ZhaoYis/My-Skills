"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyCommandProps = {
  command: string;
  label?: string;
  compact?: boolean;
};

export function CopyCommand({ command, label = "复制命令", compact = false }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  }

  return (
    <button
      className={compact ? "copy-button copy-button--compact" : "copy-button"}
      type="button"
      onClick={copy}
      aria-label={copied ? "命令已复制" : label}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? "已复制" : label}</span>
    </button>
  );
}
