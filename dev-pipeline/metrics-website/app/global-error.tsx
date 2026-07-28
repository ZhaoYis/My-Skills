'use client';

import { RequestState } from '@/components/request-state';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <RequestState detail="应用暂时无法渲染，请重试。" kind="error" onRetry={unstable_retry} requestId={error.digest} />
      </body>
    </html>
  );
}
