'use client';

import { useEffect, useRef } from 'react';
import { colorForNode } from '../lib/colors';

// Visual representation of cache nodes as bento blocks. Each block shows the
// keys currently stored, capacity utilization, hit/miss, and supports remove.
// When `flash` is set to {nodeId, kind: 'hit'|'miss'|'set'} we animate the
// matching block briefly.

export default function NodeBlocks({
  nodes = [],
  flash = null,
  highlightKey = null,
  primaryNode = null,
  replicaNodes = [],
  onRemoveNode,
}) {
  const refs = useRef({});

  useEffect(() => {
    if (!flash || !flash.nodeId) return;
    const el = refs.current[flash.nodeId];
    if (!el) return;
    const cls = flash.kind === 'miss' ? 'flash-miss' : 'flash-hit';
    el.classList.remove('flash-hit', 'flash-miss');
    void el.offsetWidth;
    el.classList.add(cls);
    const t = setTimeout(() => el.classList.remove(cls), 700);
    return () => clearTimeout(t);
  }, [flash]);

  if (!nodes.length) {
    return (
      <div className="text-sm text-white/50 mono">No nodes in cluster.</div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="node-blocks">
      {nodes.map((node) => {
        const c = colorForNode(node.id);
        const isPrimary = primaryNode === node.id;
        const isReplica = replicaNodes.includes(node.id);
        const usage = Math.min(1, node.size / Math.max(1, node.capacity));
        const total = (node.metrics.hits || 0) + (node.metrics.misses || 0);
        const hitRate = total > 0 ? (node.metrics.hits / total) * 100 : 0;
        return (
          <div
            key={node.id}
            ref={(el) => (refs.current[node.id] = el)}
            data-testid={`node-block-${node.id}`}
            className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col gap-3 transition-all"
            style={{
              boxShadow: isPrimary
                ? `inset 0 0 0 1px ${c}, 0 0 16px ${c}55`
                : isReplica
                ? `inset 0 0 0 1px ${c}88`
                : 'none',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: c, boxShadow: `0 0 8px ${c}` }}
                />
                <span className="mono text-sm font-bold tracking-tight">{node.id}</span>
                {isPrimary && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#3366FF]">primary</span>
                )}
                {isReplica && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">replica</span>
                )}
              </div>
              {onRemoveNode && nodes.length > 1 && (
                <button
                  onClick={() => onRemoveNode(node.id)}
                  data-testid={`remove-node-${node.id}`}
                  className="text-[10px] uppercase tracking-[0.18em] text-white/40 hover:text-[#FF3333] transition-colors"
                >
                  remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <Stat label="size" value={`${node.size}/${node.capacity}`} />
              <Stat label="hits" value={node.metrics.hits} accent="#00CC66" />
              <Stat label="miss" value={node.metrics.misses} accent="#FF3333" />
            </div>

            <div className="h-1 bg-white/5">
              <div
                className="h-full transition-all"
                style={{
                  width: `${usage * 100}%`,
                  background: usage > 0.85 ? '#FF3333' : c,
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {node.keys.length === 0 && (
                <span className="text-[10px] text-white/30 mono uppercase tracking-[0.2em]">empty</span>
              )}
              {node.keys.map((k) => {
                const isHi = highlightKey === k.key;
                return (
                  <span
                    key={k.key}
                    data-testid={`node-key-${node.id}-${k.key}`}
                    title={`freq=${k.freq}${k.ttlRemaining != null ? ` · ttl=${Math.ceil(k.ttlRemaining / 1000)}s` : ''}`}
                    className="mono text-[11px] px-1.5 py-0.5 border"
                    style={{
                      borderColor: isHi ? '#3366FF' : 'rgba(255,255,255,0.12)',
                      color: isHi ? 'white' : 'rgba(255,255,255,0.85)',
                      background: isHi ? 'rgba(51,102,255,0.18)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {k.key}
                    {k.ttlRemaining != null && (
                      <span className="ml-1 text-[9px] text-[#FFCC00]">·{Math.ceil(k.ttlRemaining / 1000)}s</span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
              <span>{node.policy}</span>
              <span>hit-rate {hitRate.toFixed(0)}%</span>
              <span>req {node.metrics.requests}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</span>
      <span className="mono font-bold" style={{ color: accent || 'white' }}>
        {value}
      </span>
    </div>
  );
}
