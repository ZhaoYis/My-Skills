import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import { Shell } from '@/components/shell';
import './globals.css';

const body = Manrope({ subsets: ['latin'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata: Metadata = { title: 'OpsFlow Metrics', description: 'AI 开发流水线能效指标' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${body.variable} ${mono.variable}`}><Shell>{children}</Shell></body></html>;
}
