'use client';

export default function StatsBar({ metrics }) {
  if (!metrics) return null;
  const { totals, config } = metrics;
  const items = [
    { label: 'NODES', value: config.nodeCount, accent: '#FFFFFF', testid: 'stat-nodes' },
    { label: 'POLICY', value: config.policy, accent: '#3366FF', testid: 'stat-policy' },
    { label: 'REQUESTS', value: totals.requests, accent: '#FFFFFF', testid: 'stat-requests' },
    { label: 'HITS', value: totals.hits, accent: '#00CC66', testid: 'stat-hits' },
    { label: 'MISSES', value: totals.misses, accent: '#FF3333', testid: 'stat-misses' },
    { label: 'EVICTIONS', value: totals.evictions, accent: '#FFCC00', testid: 'stat-evictions' },
    { label: 'HIT RATE', value: totals.requests ? `${(totals.hitRate * 100).toFixed(1)}%` : '—', accent: '#00CC66', testid: 'stat-hit-rate' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-white/[0.07] border border-white/10" data-testid="stats-bar">
      {items.map((it) => (
        <div key={it.label} data-testid={it.testid} className="bg-[#0A0A0A] px-3 py-3 flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-[0.22em] text-white/40">{it.label}</span>
          <span className="mono text-xl font-black" style={{ color: it.accent }}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
