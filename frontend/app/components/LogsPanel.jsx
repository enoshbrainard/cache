'use client';

import { Trash2 } from 'lucide-react';
import { colorForNode } from '../lib/colors';

const KIND_COLOR = {
  HIT: '#00CC66',
  MISS: '#FF3333',
  SET: '#3366FF',
  DELETE: '#FF7A1A',
  CONFIG: '#FFCC00',
  NODE_ADD: '#00CC66',
  NODE_REMOVE: '#FF3333',
  REBALANCE: '#00A8FF',
  ERROR: '#FF3333',
};

export default function LogsPanel({ logs = [], onClear }) {
  return (
    <div className="border border-white/10 bg-[#0E0E10] p-4 flex flex-col h-full min-h-[420px]" data-testid="logs-panel">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">Request Trace</span>
        <button
          data-testid="clear-logs-button"
          onClick={onClear}
          className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[#FF3333] transition-colors"
        >
          <Trash2 size={11} /> clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {logs.length === 0 && (
          <div className="text-xs text-white/30 mono py-6 text-center">
            <span className="terminal-cursor">awaiting traffic</span>
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {logs.map((l, i) => {
            const c = KIND_COLOR[l.event] || '#9aa0a6';
            const t = new Date(l.ts);
            const ts = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}.${t.getMilliseconds().toString().padStart(3, '0')}`;
            return (
              <li
                key={`${l.ts}-${i}`}
                data-testid={`log-row-${i}`}
                className="grid grid-cols-[88px_70px_1fr] gap-2 mono text-[11px] py-1 px-2 hover:bg-white/[0.025] border-l-2"
                style={{ borderColor: c }}
              >
                <span className="text-white/35">{ts}</span>
                <span style={{ color: c }} className="font-bold">
                  {l.event}
                </span>
                <span className="text-white/85 truncate">
                  {l.key && (
                    <span className="text-white">{l.key}</span>
                  )}
                  {l.nodeId && (
                    <>
                      <span className="text-white/30"> → </span>
                      <span style={{ color: colorForNode(l.nodeId) }}>{l.nodeId}</span>
                    </>
                  )}
                  {l.message && (
                    <span className="text-white/55"> · {stripPrefix(l.message, l.key, l.nodeId)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function stripPrefix(msg, key, nodeId) {
  // Trim the parts already shown via key/nodeId tokens to keep the line short.
  let m = msg;
  if (key) m = m.replace(new RegExp(`^${escapeRegExp(`SET ${key}`)} -> ${escapeRegExp(nodeId || '')}`), '');
  return m.trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
