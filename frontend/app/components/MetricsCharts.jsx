'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { colorForNode, COLORS } from '../lib/colors';

export default function MetricsCharts({ metrics }) {
  if (!metrics) return null;
  const { totals, perNode } = metrics;

  const pieData = [
    { name: 'Hits', value: totals.hits },
    { name: 'Misses', value: totals.misses },
  ];
  const allZero = totals.hits === 0 && totals.misses === 0;

  const barData = Object.entries(perNode).map(([id, m]) => ({
    node: id,
    requests: m.requests,
    hits: m.hits,
    misses: m.misses,
    fill: colorForNode(id),
  }));

  const hitRatePct = (totals.hitRate * 100).toFixed(1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full" data-testid="metrics-charts">
      <div className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">Hit / Miss Ratio</span>
          <span className="mono text-xs text-white/60">{totals.requests} req</span>
        </div>
        <div className="relative flex-1 min-h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allZero ? [{ name: 'idle', value: 1 }] : pieData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={allZero ? 0 : 3}
                dataKey="value"
                stroke="#0A0A0A"
                strokeWidth={2}
              >
                {allZero ? (
                  <Cell fill="rgba(255,255,255,0.08)" />
                ) : (
                  <>
                    <Cell fill={COLORS.success} />
                    <Cell fill={COLORS.danger} />
                  </>
                )}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                cursor={false}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="mono text-3xl font-black tracking-tight" data-testid="hit-rate-display">
              {allZero ? '—' : `${hitRatePct}%`}
            </span>
            <span className="text-[9px] uppercase tracking-[0.22em] text-white/40">hit rate</span>
          </div>
        </div>
        <div className="flex justify-between mono text-xs pt-2">
          <span className="text-[#00CC66]">● HIT {totals.hits}</span>
          <span className="text-[#FF3333]">● MISS {totals.misses}</span>
        </div>
      </div>

      <div className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">Requests per Node</span>
          <span className="mono text-xs text-white/60">{barData.length} nodes</span>
        </div>
        <div className="flex-1 min-h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="node" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="requests" radius={[2, 2, 0, 0]}>
                {barData.map((d) => (
                  <Cell key={d.node} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
