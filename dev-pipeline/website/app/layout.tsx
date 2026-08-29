import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://opsx-dev-pipeline.vercel.app"),
  title: {
    default: "opsx-dev-pipeline | 让 AI 的每一次变更都经得起质疑与追溯",
    template: "%s | opsx-dev-pipeline",
  },
  description:
    "开源的 AI 研发流水线 CLI，8 阶段门禁 + 子Agent 对抗验证 + PreToolUse 钩子 + 多工具共存 + Route 分级，让 Claude Code、OpenCode、Cursor 和 Codex 的每次变更都可验证、可追溯。",
  keywords: [
    "AI coding",
    "OpenSpec",
    "Claude Code",
    "OpenCode",
    "Cursor",
    "Codex",
    "研发流水线",
    "对抗验证",
    "Agent",
    "PreToolUse",
    "Pipeline Hook",
    "Route 分级",
  ],
  openGraph: {
    title: "opsx-dev-pipeline",
    description: "给团队的 AI 编程助手装上规范、门禁、PreToolUse 钩子与独立验证。30 秒初始化，多工具共存。",
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#08090A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}