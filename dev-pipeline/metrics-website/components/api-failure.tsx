import { isMetricsApiError } from '@/lib/api';
import { RequestState } from './request-state';

export function ApiFailure({ error }: { error: unknown }) {
  if (!isMetricsApiError(error)) throw error;
  if (error.kind === 'unauthorized') {
    return <RequestState detail={error.message} kind="unauthorized" requestId={error.requestId} />;
  }
  if (error.kind === 'forbidden') {
    return <RequestState detail={error.message} kind="forbidden" requestId={error.requestId} />;
  }
  if (error.kind === 'network' || error.kind === 'server') {
    return <RequestState detail={error.message} kind="unavailable" requestId={error.requestId} />;
  }
  return <RequestState detail={error.message} kind="error" requestId={error.requestId} />;
}
