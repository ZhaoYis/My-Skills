import {
  type ActionProposal,
  type ActionRisk,
  actionRisk,
  requiresApproval,
} from '../domain/decisions.js';

export type AutomationMode = 'assisted' | 'semi-auto' | 'autonomous';

export interface PolicyDecision {
  requiresApproval: boolean;
  risk: ActionRisk;
  reason: string;
}

export class ApprovalPolicy {
  constructor(
    private readonly mode: AutomationMode = 'assisted',
    private readonly explicitlyAllowedActions: ReadonlySet<string> = new Set(),
  ) {}

  evaluate(action: ActionProposal): PolicyDecision {
    const risk = action.risk ?? actionRisk(action.kind);
    if (this.explicitlyAllowedActions.has(action.kind)) {
      return { requiresApproval: false, risk, reason: 'explicitly-allowed-by-policy' };
    }
    if (this.mode === 'autonomous' && risk === 'low') {
      return { requiresApproval: false, risk, reason: 'low-risk-autonomous-action' };
    }
    if (this.mode === 'semi-auto' && risk === 'low') {
      return { requiresApproval: false, risk, reason: 'low-risk-semi-auto-action' };
    }
    if (requiresApproval({ ...action, risk })) {
      return { requiresApproval: true, risk, reason: `${risk}-risk-action-requires-approval` };
    }
    return { requiresApproval: false, risk, reason: 'safe-action' };
  }
}
