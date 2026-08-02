export type ActionRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ActionProposal {
  actionId: string;
  kind: string;
  phase: number;
  args?: Record<string, unknown>;
  risk: ActionRisk;
  requiresApproval?: boolean;
  reason?: string;
}

const highRiskKinds = new Set([
  'proposal.approve',
  'implementation.approve',
  'review.skip',
  'tests.skip',
  'tests.record-debt',
  'archive.confirm',
  'git.commit',
  'git.push',
  'git.merge',
  'git.delete-branch',
  'git.create-tag',
]);

export function requiresApproval(
  action: Pick<ActionProposal, 'kind' | 'risk' | 'requiresApproval'>,
): boolean {
  return (
    action.requiresApproval === true ||
    action.risk === 'critical' ||
    action.risk === 'high' ||
    highRiskKinds.has(action.kind)
  );
}

export function actionRisk(kind: string): ActionRisk {
  if (kind === 'git.delete-branch' || kind === 'git.create-tag') return 'critical';
  if (highRiskKinds.has(kind)) return 'high';
  if (kind.startsWith('git.') || kind.startsWith('tests.') || kind.startsWith('verify.'))
    return 'medium';
  return 'low';
}
