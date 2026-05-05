'use client';

import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';

export default function ConfigPanel({ config = {}, onChange, onAddNode, onReset, busy }) {
  const [latency, setLatency] = useState(config.artificialLatencyMs ?? 0);
  const [capacity, setCapacity] = useState(config.capacityPerNode ?? 8);
  const [rf, setRf] = useState(config.replicationFactor ?? 1);

  function commit(partial) {
    onChange(partial);
  }

  return (
    <div className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col gap-4" data-testid="config-panel">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">Cluster Config</span>
        <span className="mono text-[10px] text-white/40">{config.policy} · RF={config.replicationFactor}</span>
      </div>

      <div>
        <Label>Eviction Policy</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {['LRU', 'LFU'].map((p) => {
            const active = config.policy === p;
            return (
              <button
                key={p}
                data-testid={`policy-${p}`}
                onClick={() => commit({ policy: p })}
                className={`mono text-sm font-bold py-2 transition-colors ${
                  active
                    ? 'bg-white text-black'
                    : 'bg-transparent border border-white/15 text-white/70 hover:bg-white/5'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Capacity / node ({capacity})</Label>
        <input
          data-testid="capacity-slider"
          type="range"
          min="2"
          max="32"
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value, 10))}
          onMouseUp={() => commit({ capacityPerNode: capacity })}
          onTouchEnd={() => commit({ capacityPerNode: capacity })}
          className="w-full accent-[#3366FF]"
        />
      </div>

      <div>
        <Label>Replication Factor ({rf})</Label>
        <input
          data-testid="rf-slider"
          type="range"
          min="1"
          max="4"
          value={rf}
          onChange={(e) => setRf(parseInt(e.target.value, 10))}
          onMouseUp={() => commit({ replicationFactor: rf })}
          onTouchEnd={() => commit({ replicationFactor: rf })}
          className="w-full accent-[#3366FF]"
        />
      </div>

      <div>
        <Label>Artificial Latency ({latency} ms)</Label>
        <input
          data-testid="latency-slider"
          type="range"
          min="0"
          max="500"
          step="10"
          value={latency}
          onChange={(e) => setLatency(parseInt(e.target.value, 10))}
          onMouseUp={() => commit({ artificialLatencyMs: latency })}
          onTouchEnd={() => commit({ artificialLatencyMs: latency })}
          className="w-full accent-[#3366FF]"
        />
      </div>

      <div className="flex gap-2">
        <button
          data-testid="add-node-button"
          disabled={busy}
          onClick={onAddNode}
          className="flex items-center gap-2 bg-[#3366FF] text-white mono text-xs font-bold px-3 py-2 hover:bg-[#3366FF]/90 transition-colors disabled:opacity-40"
        >
          <Plus size={14} /> ADD NODE
        </button>
        <button
          data-testid="reset-cluster-button"
          disabled={busy}
          onClick={onReset}
          className="flex items-center gap-2 border border-white/15 text-white/80 mono text-xs font-bold px-3 py-2 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <RotateCcw size={14} /> RESET
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="text-[10px] uppercase tracking-[0.22em] text-white/50">{children}</label>
  );
}
