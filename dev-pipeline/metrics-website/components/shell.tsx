import { Activity, Boxes, Database, Gauge, LogOut, Users } from 'lucide-react';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { currentUserIsAdmin } from '@/lib/admin-auth';

const navigation = [
  { href: '/', label: '个人能效', icon: Gauge },
  { href: '/team', label: '团队观察', icon: Users },
  { href: '/admin', label: '采集管理', icon: Database },
];

export async function Shell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const simulatedId =
    process.env.NODE_ENV === 'development' && !session ? process.env.METRICS_DEV_DEVELOPER_ID : undefined;
  const isAdmin = await currentUserIsAdmin();
  const visibleNavigation = navigation.filter(
    ({ href }) => href !== '/admin' || isAdmin,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="OpsFlow 指标首页">
          <span className="brand-mark"><Activity size={18} /></span>
          <span><b>OpsFlow</b><small>METRICS / 03</small></span>
        </Link>
        <nav aria-label="主导航">
          {visibleNavigation.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href}><Icon size={17} /><span>{label}</span></Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <Boxes size={16} />
          <span><b>可信数据</b><small>仅验真快照</small></span>
          <i aria-label="服务正常" />
        </div>
        {simulatedId && (
          <div className="sidebar-status simulated-identity">
            <Users size={16} />
            <span><b>开发模拟身份</b><small>Developer #{simulatedId}</small></span>
          </div>
        )}
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button className="icon-command sidebar-exit" title="退出登录" type="submit"><LogOut size={17} /><span>退出</span></button>
        </form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
