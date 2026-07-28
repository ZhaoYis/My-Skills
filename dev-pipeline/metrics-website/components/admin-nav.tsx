import Link from 'next/link';

export function AdminNav({ active }: { active: 'repos' | 'organization' }) {
  return (
    <nav aria-label="管理视图" className="admin-tabs">
      <Link className={active === 'repos' ? 'active' : ''} href="/admin">仓库管理</Link>
      <Link className={active === 'organization' ? 'active' : ''} href="/admin/organization">组织管理</Link>
    </nav>
  );
}
