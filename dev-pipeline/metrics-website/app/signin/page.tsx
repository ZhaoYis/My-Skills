import { Activity, ArrowRight } from 'lucide-react';
import { signIn } from '@/auth';

export default function SignInPage() {
  return <div className="signin"><div className="signin-mark"><Activity size={32} /></div><p className="kicker">OPSFLOW / IDENTITY</p><h1>进入能效控制台</h1><p>使用组织域账号继续。</p><form action={async () => { 'use server'; await signIn('company-oidc', { redirectTo: '/' }); }}><button className="primary-command" type="submit">域账号登录<ArrowRight size={17} /></button></form></div>;
}
