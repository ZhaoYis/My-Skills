import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleGauge, Clock3, GitPullRequest, PauseCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { Overview } from '@/lib/types';
import { PhaseChart, TrendChart } from './charts';

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function Dashboard({ data, scope, periodDays = 30, periodBase = '/' }: { data: Overview; scope: string; periodDays?: number; periodBase?: string }) {
  const cards = [
    { label: '本月完成', value: data.monthlyCompleted, suffix: '项', icon: CheckCircle2, signal: 'good' },
    { label: '有效周期', value: data.avgEffectiveCycleTimeMinutes, suffix: '分钟', icon: Clock3, signal: 'neutral' },
    { label: '一次审查通过', value: percent(data.reviewPassRate), suffix: '', icon: GitPullRequest, signal: 'good' },
    { label: '超期未完成', value: percent(data.overdueRate), suffix: '', icon: CircleGauge, signal: data.overdueRate > 0.15 ? 'alert' : 'neutral' },
  ];
  return (
    <>
      <header className="topbar">
        <div><span className="live-dot" /> DATA CURRENT</div>
        <div className="period-control" aria-label="统计周期">{[7, 30, 90].map((days) => <Link className={periodDays === days ? 'active' : ''} href={`${periodBase}${periodBase.includes('?') ? '&' : '?'}days=${days}`} key={days}>{days}D</Link>)}</div>
      </header>
      <div className="workspace">
        <section className="page-heading">
          <div><p className="kicker">{scope} / OVERVIEW</p><h1>开发能效脉搏</h1><p>交付速度、质量门禁与流程稳定性的同屏观察。</p></div>
          <div className="completion-dial"><strong>{percent(data.completionRate)}</strong><span>总完成率</span></div>
        </section>

        <section className="metric-grid" aria-label="关键指标">
          {cards.map(({ label, value, suffix, icon: Icon, signal }) => (
            <article className={`metric-card ${signal}`} key={label}>
              <div><span>{label}</span><Icon size={18} /></div>
              <strong>{value}<small>{suffix}</small></strong>
              <p><ArrowUpRight size={14} /> 可信快照 {data.totalRuns} 条</p>
            </article>
          ))}
        </section>

        <section className="analysis-grid">
          <article className="panel trend-panel">
            <div className="panel-title"><div><span>FLOW / 14D</span><h2>周期时间趋势</h2></div><b><ArrowDownRight size={15} /> P50 {data.medianCycleTimeMinutes}m</b></div>
            <TrendChart data={data.recentTrend} />
          </article>
          <article className="panel phase-panel">
            <div className="panel-title"><div><span>PHASE / AVG</span><h2>阶段耗时</h2></div></div>
            <PhaseChart data={data.phaseBreakdown} />
          </article>
        </section>

        <section className="quality-strip">
          <div><GitPullRequest size={18} /><span>平均审查轮次</span><strong>{data.avgReviewRounds}</strong></div>
          <div><RotateCcw size={18} /><span>平均回退次数</span><strong>{data.avgRollbacksPerChange}</strong></div>
          <div><PauseCircle size={18} /><span>暂停率</span><strong>{percent(data.pauseRate)}</strong></div>
          <div><CheckCircle2 size={18} /><span>测试一次通过</span><strong>{percent(data.testFirstPassRate)}</strong></div>
        </section>
      </div>
    </>
  );
}
