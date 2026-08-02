export interface Check {
  id: string;
  description: string;
}

export interface Gate {
  id: string;
  description: string;
}

export interface ApprovalPoint {
  id: string;
  description: string;
  options: string[];
}

export interface RecoveryRoute {
  when: string;
  to: number;
}

export interface PhaseDefinition {
  id: number;
  name: string;
  objective: string;
  allowedActions: string[];
  entryChecks: Check[];
  exitGates: Gate[];
  approvalPoints: ApprovalPoint[];
  recoveryRoutes: RecoveryRoute[];
}

export const DEFAULT_PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    id: 0,
    name: 'entrance',
    objective: '预检环境并确定恢复入口',
    allowedActions: ['openspec.preflight', 'state.init', 'state.get'],
    entryChecks: [],
    exitGates: [],
    approvalPoints: [
      {
        id: 'feature-association',
        description: '是否关联外部需求',
        options: ['associate', 'skip'],
      },
    ],
    recoveryRoutes: [],
  },
  {
    id: 1,
    name: 'propose',
    objective: '生成并确认 OpenSpec 提案制品',
    allowedActions: [
      'openspec.status',
      'openspec.createChange',
      'openspec.instructions',
      'openspec.validate',
      'artifact.write',
    ],
    entryChecks: [],
    exitGates: [{ id: 'proposal-approved', description: 'proposalApproved=true' }],
    approvalPoints: [
      { id: 'proposal', description: '确认提案并开始实施', options: ['approve', 'revise'] },
    ],
    recoveryRoutes: [],
  },
  {
    id: 2,
    name: 'apply',
    objective: '按 tasks 实施代码变更',
    allowedActions: [
      'openspec.status',
      'openspec.instructions',
      'openspec.apply',
      'artifact.write',
      'state.recordAttempt',
    ],
    entryChecks: [{ id: 'proposal-approved', description: '提案已确认' }],
    exitGates: [{ id: 'implementation-confirmed', description: 'implementationConfirmed=true' }],
    approvalPoints: [
      {
        id: 'implementation',
        description: '确认实施摘要',
        options: ['review', 'skip-review', 'revise'],
      },
    ],
    recoveryRoutes: [{ when: 'requirements-invalid', to: 1 }],
  },
  {
    id: 3,
    name: 'review',
    objective: '审查代码变更并处理问题',
    allowedActions: ['git.diff', 'review.run', 'state.recordAttempt'],
    entryChecks: [],
    exitGates: [{ id: 'review-passed', description: 'review.status=passed' }],
    approvalPoints: [
      { id: 'review-issues', description: '处理审查问题', options: ['fix', 'continue', 'pause'] },
    ],
    recoveryRoutes: [
      { when: 'code-invalid', to: 2 },
      { when: 'requirements-invalid', to: 1 },
    ],
  },
  {
    id: 4,
    name: 'tests',
    objective: '运行测试并记录测试门禁',
    allowedActions: ['tests.detect', 'tests.run', 'state.recordAttempt'],
    entryChecks: [],
    exitGates: [{ id: 'tests-recorded', description: 'tests.status 已记录' }],
    approvalPoints: [
      { id: 'tests', description: '选择测试处理方式', options: ['run', 'skip', 'record-debt'] },
    ],
    recoveryRoutes: [],
  },
  {
    id: 5,
    name: 'archive',
    objective: '验证、同步规范并归档变更',
    allowedActions: ['verify.detect', 'verify.run', 'openspec.validate', 'openspec.archive'],
    entryChecks: [],
    exitGates: [
      { id: 'verify-passed', description: 'verify.status=passed 或 skipped' },
      { id: 'archive-path', description: 'archivePath 已记录' },
    ],
    approvalPoints: [
      {
        id: 'delivery-mode',
        description: '选择归档后交付方式',
        options: ['merge', 'push-only', 'local-only'],
      },
    ],
    recoveryRoutes: [
      { when: 'verify-failed-code', to: 2 },
      { when: 'verify-failed-requirement', to: 1 },
    ],
  },
  {
    id: 6,
    name: 'commit-push',
    objective: '提交并推送源分支',
    allowedActions: [
      'git.status',
      'git.diff',
      'git.stage',
      'git.commit',
      'git.push',
      'state.complete',
    ],
    entryChecks: [],
    exitGates: [],
    approvalPoints: [
      { id: 'commit', description: '确认提交', options: ['approve', 'edit', 'cancel'] },
      { id: 'source-push', description: '确认推送源分支', options: ['approve', 'defer', 'cancel'] },
    ],
    recoveryRoutes: [],
  },
  {
    id: 7,
    name: 'merge-deliver',
    objective: '合并、验证并完成交付',
    allowedActions: [
      'git.fetch',
      'git.merge',
      'tests.run',
      'verify.run',
      'git.push',
      'state.complete',
    ],
    entryChecks: [{ id: 'source-pushed', description: '源分支已推送' }],
    exitGates: [{ id: 'target-pushed', description: '目标分支已推送' }],
    approvalPoints: [
      { id: 'merge', description: '确认合并', options: ['approve', 'cancel'] },
      {
        id: 'target-push',
        description: '确认推送目标分支',
        options: ['approve', 'defer', 'cancel'],
      },
    ],
    recoveryRoutes: [],
  },
];

export function getPhaseDefinition(phase: number): PhaseDefinition {
  const definition = DEFAULT_PHASE_DEFINITIONS.find((item) => item.id === phase);
  if (!definition) throw new Error(`Unknown pipeline phase: ${phase}`);
  return definition;
}
