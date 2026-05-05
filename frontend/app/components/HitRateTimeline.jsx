'use client';

import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Area, ComposedChart } from 'recharts';
import { COLORS } from '../lib/colors';

// Rolling 60-sample window of hit-rate over time. Samples are appended on
// every metrics update; the window value is computed from the *delta*
// between consecutive samples so the chart reflects recent behaviour rather
// than the cumulative all-time hit rate.

const MAX_SAMPLES = 60;

export default function HitRateTimeline({ metrics }) {
  const [series, setSeries] = useState([]);
  const lastRef = useRef(null);

  useEffect(() => {
    if (!metrics) return;
    const { hits, misses, requests } = metrics.totals;
    const now = Date.now();
    const prev = lastRef.current;
    let windowHitRate = null;
    let dHits = 0;
    let dMisses = 0;
    if (prev) {
      dHits = Math.max(0, hits - prev.hits);
      dMisses = Math.max(0, misses - prev.misses);
      const dTotal = dHits + dMisses;
      if (dTotal > 0) windowHitRate = (dHits / dTotal) * 100;
    }
    lastRef.current = { hits, misses, requests, t: now };
    setSeries((prevSeries) => {
      const last = prevSeries[prevSeries.length - 1];
      // Skip duplicate samples that come in too close together.
      if (last && now - last.t < 400) return prevSeries;
      const carry = last ? last.hitRate : null;
      const next = {
        t: now,
        label: formatTime(now),
        hitRate: windowHitRate != null ? windowHitRate : (dHits + dMisses === 0 ? carry : 0),
        dHits,
        dMisses,
        idle: dHits + dMisses === 0,
      };
      const updated = [...prevSeries, next];
      if (updated.length > MAX_SAMPLES) updated.splice(0, updated.length - MAX_SAMPLES);
      return updated;
    });
  }, [metrics]);

  const recent = series.slice(-MAX_SAMPLES);
  const latest = recent[recent.length - 1];
  const avg =
    recent.filter((s) => s.hitRate != null).reduce((a, b) => a + b.hitRate, 0) /
    Math.max(1, recent.filter((s) => s.hitRate != null).length || 1);

  return (
    <div className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col h-full" data-testid="hit-rate-timeline">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">Hit Rate · 60-sample window</span>
        <div className="flex items-center gap-3 mono text-[11px]">
          <span className="text-white/40">avg <span className="text-white">{Number.isFinite(avg) ? avg.toFixed(1) : '—'}%</span></span>
          <span className="text-white/40">now <span className="text-[#00CC66]">{latest && latest.hitRate != null ? `${latest.hitRate.toFixed(1)}%` : '—'}</span></span>
        </div>
      </div>
      <div className="flex-1 min-h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={recent} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.success} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.success} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
              contentStyle={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              formatter={(v, name, p) => [
                v == null ? 'idle' : `${Number(v).toFixed(1)}%`,
                p.payload && p.payload.idle ? 'idle' : 'hit rate',
              ]}
              labelFormatter={(l) => l}
            />
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
            <Area
              type="monotone"
              dataKey="hitRate"
              stroke="none"
              fill="url(#hrFill)"
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="hitRate"
              stroke={COLORS.success}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {recent.length === 0 && (
        <div className="text-[10px] mono text-white/30 text-center pt-2">awaiting samples…</div>
      )}
    </div>
  );
}

function formatTime(ts) {
  const t = new Date(ts);
  return `${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`;
}
