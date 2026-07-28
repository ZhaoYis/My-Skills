'use client';

import { RequestState } from '@/components/request-state';

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RequestState detail="页面渲染失败，请重试。" kind="error" onRetry={unstable_retry} requestId={error.digest} />;
}
