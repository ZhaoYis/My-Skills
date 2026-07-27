export interface PhaseMetric {
  phase: number;
  count: number;
  avgSec: number;
  p50Sec: number;
  p95Sec: number;
}

export interface TrendMetric {
  date: string;
  runs: number;
  avgCycleMin: number;
}

export interface Overview {
  totalRuns: number;
  completedRuns: number;
  completionRate: number;
  abandonmentRate: number;
  monthlyCompleted: number;
  overdueRate: number;
  avgCycleTimeMinutes: number;
  avgEffectiveCycleTimeMinutes: number;
  medianCycleTimeMinutes: number;
  avgReviewRounds: number;
  reviewPassRate: number;
  testFirstPassRate: number;
  avgTestAttempts: number;
  avgVerifyAttempts: number;
  avgRollbacksPerChange: number;
  pauseCount: number;
  pauseRate: number;
  bypassFrequency: Record<string, number>;
  bypassRate: number;
  phaseBreakdown: PhaseMetric[];
  recentTrend: TrendMetric[];
}
