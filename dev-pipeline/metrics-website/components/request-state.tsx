'use client';

import { Ban, Inbox, LoaderCircle, LogIn, RefreshCw, ServerCrash, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type StateKind =
  | 'loading'
  | 'empty'
  | 'no-team'
  | 'empty-team'
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'error';

const stateContent = {
  loading: { title: '正在加载指标', detail: '正在获取最新可信快照。', icon: LoaderCircle },
  empty: { title: '暂无可信数据', detail: '当前范围内没有可统计的验真快照。', icon: Inbox },
  'no-team': { title: '尚未分配团队', detail: '当前账号没有可见团队，请联系管理员完成团队分配。', icon: Ban },
  'empty-team': { title: '团队暂无成员', detail: '当前团队及其子团队中没有在职成员。', icon: Inbox },
  unauthorized: { title: '登录状态已失效', detail: '请重新登录后继续查看指标。', icon: LogIn },
  forbidden: { title: '无权访问', detail: '当前身份没有该页面或数据范围的权限。', icon: Ban },
  unavailable: { title: '指标服务不可用', detail: '服务暂时无法响应，请稍后重试。', icon: ServerCrash },
  error: { title: '请求未完成', detail: '指标服务拒绝了本次请求。', icon: TriangleAlert },
} satisfies Record<StateKind, { title: string; detail: string; icon: typeof Inbox }>;

export function RequestState({
  kind,
  detail,
  requestId,
  onRetry,
  compact = false,
}: {
  kind: StateKind;
  detail?: string;
  requestId?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const content = stateContent[kind];
  const Icon = content.icon;
  return (
    <div className={`${compact ? 'compact ' : 'workspace '}request-state`} data-state={kind}>
      <Icon className={kind === 'loading' ? 'spin' : ''} size={28} />
      <p className="kicker">REQUEST / {kind.toUpperCase()}</p>
      <h1>{content.title}</h1>
      <p>{detail || content.detail}</p>
      {requestId && <code>Request {requestId}</code>}
      <div className="state-actions">
        {kind === 'unauthorized' && <Link className="primary-command" href="/signin">重新登录</Link>}
        {(kind === 'unavailable' || kind === 'error') && (
          <button className="primary-command" onClick={onRetry ?? (() => router.refresh())} type="button">
            <RefreshCw size={16} />重试
          </button>
        )}
      </div>
    </div>
  );
}
