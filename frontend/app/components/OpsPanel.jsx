'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, Zap } from 'lucide-react';

export default function OpsPanel({ onSet, onGet, onDelete, busy }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [ttl, setTtl] = useState('');

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  return (
    <div className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col gap-3" data-testid="ops-panel">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">Operations</span>
        <span className="mono text-[10px] text-white/30">SET / GET / DEL</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          data-testid="key-input"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key (e.g. user:42)"
          className="bg-[#0A0A0A] border border-white/15 px-3 py-2 mono text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#3366FF]"
        />
        <input
          data-testid="value-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className="bg-[#0A0A0A] border border-white/15 px-3 py-2 mono text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#3366FF]"
        />
      </div>
      <div className="flex gap-2">
        <input
          data-testid="ttl-input"
          value={ttl}
          onChange={(e) => setTtl(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="ttl ms (optional)"
          className="bg-[#0A0A0A] border border-white/15 px-3 py-2 mono text-xs placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#3366FF] w-40"
        />
        <button
          data-testid="quick-ttl-5s"
          onClick={() => setTtl(String(5000))}
          className="text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white border border-white/10 px-2"
          type="button"
        >
          5s
        </button>
        <button
          data-testid="quick-ttl-30s"
          onClick={() => setTtl(String(30000))}
          className="text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white border border-white/10 px-2"
          type="button"
        >
          30s
        </button>
        <button
          data-testid="quick-ttl-clear"
          onClick={() => setTtl('')}
          className="text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white border border-white/10 px-2"
          type="button"
        >
          ∞
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          data-testid="op-set-button"
          disabled={busy || !key || !value}
          onClick={() => onSet(key, value, ttl ? clamp(parseInt(ttl, 10), 0, 86_400_000) : null)}
          className="flex items-center justify-center gap-2 bg-white text-black mono text-sm font-bold py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
        >
          <Plus size={14} /> SET
        </button>
        <button
          data-testid="op-get-button"
          disabled={busy || !key}
          onClick={() => onGet(key)}
          className="flex items-center justify-center gap-2 bg-[#3366FF] text-white mono text-sm font-bold py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3366FF]/90 transition-colors"
        >
          <Search size={14} /> GET
        </button>
        <button
          data-testid="op-delete-button"
          disabled={busy || !key}
          onClick={() => onDelete(key)}
          className="flex items-center justify-center gap-2 border border-[#FF3333]/60 text-[#FF3333] mono text-sm font-bold py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FF3333]/10 transition-colors"
        >
          <Trash2 size={14} /> DEL
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          data-testid="seed-keys-button"
          onClick={async () => {
            const samples = ['user:1', 'user:42', 'cart:99', 'session:abc', 'product:7', 'cart:7', 'feature:flag', 'profile:zee'];
            for (const k of samples) {
              await onSet(k, `v_${k}`, null);
            }
          }}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white border border-white/10 px-2.5 py-1.5"
        >
          <Zap size={12} /> seed sample keys
        </button>
        <button
          data-testid="random-get-button"
          onClick={async () => {
            const k = `user:${Math.floor(Math.random() * 100)}`;
            await onGet(k);
          }}
          className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white border border-white/10 px-2.5 py-1.5"
        >
          random GET
        </button>
      </div>
    </div>
  );
}
