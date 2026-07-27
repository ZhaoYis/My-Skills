'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PhaseMetric, TrendMetric } from '@/lib/types';

const phaseNames = ['入口', '提案', '实现', '审查', '测试', '归档', '交付'];

export function TrendChart({ data }: { data: TrendMetric[] }) {
  return (
    <div className="chart-frame" aria-label="近期周期时间趋势图">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#dedbd4" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} unit="m" />
          <Tooltip contentStyle={{ borderRadius: 4, border: '1px solid #262522', boxShadow: '4px 4px 0 #262522' }} />
          <Area dataKey="avgCycleMin" name="平均周期" type="monotone" stroke="#d84a2f" fill="#f3c8b8" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PhaseChart({ data }: { data: PhaseMetric[] }) {
  const formatted = data.map((item) => ({ ...item, name: phaseNames[item.phase], minutes: Math.round(item.avgSec / 60) }));
  return (
    <div className="chart-frame" aria-label="阶段平均耗时图">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#dedbd4" strokeDasharray="2 5" horizontal={false} />
          <XAxis type="number" axisLine={false} tickLine={false} unit="m" />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={42} />
          <Tooltip cursor={{ fill: '#ebe8e0' }} contentStyle={{ borderRadius: 4, border: '1px solid #262522', boxShadow: '4px 4px 0 #262522' }} />
          <Bar dataKey="minutes" name="平均耗时" fill="#168b78" radius={[0, 3, 3, 0]} barSize={17} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
