import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://opsx-dev-pipeline.vercel.app"),
  title: {
    default: "opsx-dev-pipeline | 让 AI 在团队规范内工作",
    template: "%s | opsx-dev-pipeline",
  },
  description:
    "开源的 AI 研发流水线 CLI，用 7 阶段门禁统一 Claude Code、Cursor 和 Codex 的提案、实施、审查、测试与交付流程。",
  keywords: ["AI coding", "OpenSpec", "Claude Code", "Cursor", "Codex", "研发流水线"],
  openGraph: {
    title: "opsx-dev-pipeline",
    description: "给团队的 AI 编程助手装上规范、门禁和交付流程。",
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f4f5ef",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
