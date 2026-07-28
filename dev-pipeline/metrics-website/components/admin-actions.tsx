'use client';

import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useActionState } from 'react';

export interface AdminActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

const initialState: AdminActionState = { status: 'idle' };

export function TriggerAllAction({
  action,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="admin-action">
      <div className="admin-action-buttons">
        <button className="primary-command" disabled={pending} name="trigger" type="submit" value="all">
          {pending ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          {pending ? '正在提交' : '全部采集'}
        </button>
        <button className="secondary-command" disabled={pending} name="trigger" type="submit" value="dry-run">
          Dry-run
        </button>
      </div>
      {state.status !== 'idle' && (
        <span className={`action-feedback ${state.status}`} role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}
