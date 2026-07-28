import { Activity, ArrowRight } from 'lucide-react';
import { signIn } from '@/auth';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="signin"><div className="signin-mark"><Activity size={32} /></div><p className="kicker">OPSFLOW / IDENTITY</p><h1>进入能效控制台</h1><p>使用组织域账号继续。</p>{error && <p className="danger-note" role="alert">登录未完成，请重新验证域账号。</p>}<form action={async () => { 'use server'; await signIn('company-oidc', { redirectTo: '/' }); }}><button className="primary-command" type="submit">域账号登录<ArrowRight size={17} /></button></form></div>;
}
