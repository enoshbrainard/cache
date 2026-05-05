'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Cpu, GitBranch } from 'lucide-react';
import { api } from './lib/api';
import HashRingViz from './components/HashRingViz';
import NodeBlocks from './components/NodeBlocks';
import MetricsCharts from './components/MetricsCharts';
import HitRateTimeline from './components/HitRateTimeline';
import OpsPanel from './components/OpsPanel';
import ConfigPanel from './components/ConfigPanel';
import LogsPanel from './components/LogsPanel';
import StatsBar from './components/StatsBar';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [highlight, setHighlight] = useState(null); // {key, primary, replicas, angle}
  const [flash, setFlash] = useState(null); // {nodeId, kind}
  const [lastResult, setLastResult] = useState(null); // {op, key, hit, value, primary}
  const [migrations, setMigrations] = useState([]); // active key-migration animations
  const seenLogTsRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => { setMounted(true); }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, m, l] = await Promise.all([api.state(), api.metrics(), api.logs()]);
      setState(s);
      setMetrics(m);
      setLogs(l.logs);
      setError(null);
      // Detect any new REBALANCE / NODE_REMOVE log entries with migrations and
      // queue them up for animation. Logs are newest-first; we use the
      // timestamp watermark to avoid replaying old events.
      const newest = l.logs.length ? new Date(l.logs[0].ts).getTime() : 0;
      if (newest > seenLogTsRef.current) {
        const fresh = [];
        for (const entry of l.logs) {
          const ts = new Date(entry.ts).getTime();
          if (ts <= seenLogTsRef.current) break;
          if ((entry.event === 'REBALANCE' || entry.event === 'NODE_REMOVE') && Array.isArray(entry.migrations)) {
            for (const mig of entry.migrations) {
              fresh.push({ ...mig, id: `${ts}-${mig.from}-${mig.to}-${mig.key}` });
            }
          }
        }
        seenLogTsRef.current = newest;
        if (fresh.length > 0) {
          setMigrations((prev) => [...prev, ...fresh]);
          // Auto-clear after the SVG animation duration.
          setTimeout(() => {
            setMigrations((prev) => prev.filter((m) => !fresh.find((f) => f.id === m.id)));
          }, 1200);
        }
      }
    } catch (e) {
      setError(`Backend unreachable: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  async function handleSet(key, value, ttlMs) {
    setBusy(true);
    try {
      const lookup = await api.lookup(key);
      const out = await api.setKey(key, value, ttlMs);
      setHighlight({ key, primary: out.primary, replicas: out.replicas || [], angle: lookup.angle });
      setFlash({ nodeId: out.primary, kind: 'set' });
      setLastResult({ op: 'SET', key, primary: out.primary, evicted: out.evicted });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleGet(key) {
    setBusy(true);
    try {
      const lookup = await api.lookup(key);
      const out = await api.getKey(key);
      setHighlight({ key, primary: out.primary, replicas: out.replicas || [], angle: lookup.angle });
      setFlash({ nodeId: out.primary, kind: out.hit ? 'hit' : 'miss' });
      setLastResult({ op: 'GET', key, hit: out.hit, value: out.value, primary: out.primary, expired: out.expired });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleDelete(key) {
    setBusy(true);
    try {
      const lookup = await api.lookup(key);
      const out = await api.deleteKey(key);
      setHighlight({ key, primary: out.owners[0], replicas: out.owners.slice(1), angle: lookup.angle });
      setFlash({ nodeId: out.owners[0], kind: out.deleted ? 'hit' : 'miss' });
      setLastResult({ op: 'DELETE', key, deleted: out.deleted });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleConfig(partial) {
    setBusy(true);
    try {
      await api.config(partial);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleAddNode() {
    setBusy(true);
    try {
      await api.addNode();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleRemoveNode(id) {
    setBusy(true);
    try {
      await api.removeNode(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleReset() {
    setBusy(true);
    try {
      await api.reset();
      setHighlight(null);
      setLastResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleClearLogs() {
    try {
      await api.clearLogs();
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  const cfg = metrics ? metrics.config : { policy: 'LRU', capacityPerNode: 8, replicationFactor: 1, artificialLatencyMs: 0, nodeCount: 0 };

  return (
    <main className="min-h-screen w-full bg-[#0A0A0A] text-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-white/10 pb-6" data-testid="app-header">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
              <Cpu size={12} className="text-[#3366FF]" />
              <span>distributed cache simulator</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00CC66] animate-pulse ml-1" />
              <span className="text-[#00CC66]">live</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              consistent hashing,
              <br />
              <span className="text-white/40">visualized.</span>
            </h1>
            <p className="text-sm text-white/50 max-w-xl">
              Route keys across cache nodes via a consistent-hash ring. Switch eviction strategies (LRU / LFU),
              add or remove nodes, observe key migration, replication and TTL — in real time.
            </p>
          </div>
          <div className="flex items-center gap-3 mono text-[11px] text-white/40">
            <span className="flex items-center gap-1.5"><GitBranch size={12} /> express + next.js</span>
            <span className="flex items-center gap-1.5"><Activity size={12} className="text-[#00CC66]" /> {logs.length} events</span>
          </div>
        </header>

        {error && (
          <div data-testid="error-banner" className="border border-[#FF3333]/40 bg-[#FF3333]/10 text-[#FF3333] px-4 py-2 mono text-xs">
            {error}
          </div>
        )}

        <StatsBar metrics={metrics} />

        {/* Last operation result */}
        {lastResult && (
          <div data-testid="last-result" className="mono text-xs text-white/70 bg-[#0E0E10] border border-white/10 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="text-white/40 uppercase tracking-[0.2em] text-[10px]">last op</span>
            <span><span className="text-white/40">op:</span> <span className="text-white font-bold">{lastResult.op}</span></span>
            <span><span className="text-white/40">key:</span> <span className="text-white">{lastResult.key}</span></span>
            {lastResult.primary && (
              <span><span className="text-white/40">node:</span> <span className="text-white">{lastResult.primary}</span></span>
            )}
            {lastResult.op === 'GET' && (
              <span>
                <span className="text-white/40">result:</span>{' '}
                <span style={{ color: lastResult.hit ? '#00CC66' : '#FF3333' }} className="font-bold">
                  {lastResult.hit ? 'HIT' : lastResult.expired ? 'MISS (expired)' : 'MISS'}
                </span>
              </span>
            )}
            {lastResult.op === 'GET' && lastResult.hit && (
              <span><span className="text-white/40">value:</span> <span className="text-white">{String(lastResult.value)}</span></span>
            )}
            {lastResult.op === 'SET' && lastResult.evicted && (
              <span className="text-[#FFCC00]">evicted: {lastResult.evicted}</span>
            )}
            {lastResult.op === 'DELETE' && (
              <span style={{ color: lastResult.deleted ? '#00CC66' : '#FF3333' }} className="font-bold">
                {lastResult.deleted ? 'DELETED' : 'NOT FOUND'}
              </span>
            )}
          </div>
        )}

        {/* Top row: Ring + Ops + Config */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 border border-white/10 bg-[#0E0E10] p-4 min-h-[460px]">
            {mounted && (
              <HashRingViz
                ring={state ? state.ring : []}
                nodes={state ? state.nodes : []}
                keyHighlight={highlight}
                replicationFactor={cfg.replicationFactor}
                migrations={migrations}
              />
            )}
          </div>
          <div className="lg:col-span-3 flex flex-col gap-4">
            <OpsPanel onSet={handleSet} onGet={handleGet} onDelete={handleDelete} busy={busy} />
            <ConfigPanel
              config={cfg}
              onChange={handleConfig}
              onAddNode={handleAddNode}
              onReset={handleReset}
              busy={busy}
            />
          </div>
          <div className="lg:col-span-3">
            <LogsPanel logs={logs} onClear={handleClearLogs} />
          </div>
        </section>

        {/* Middle row: charts */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {mounted && (
            <>
              <div className="lg:col-span-2">
                <MetricsCharts metrics={metrics} />
              </div>
              <div className="lg:col-span-1">
                <HitRateTimeline metrics={metrics} />
              </div>
            </>
          )}
        </section>

        {/* Bottom row: nodes */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.24em] text-white/50">Cache Nodes</h2>
            <span className="mono text-[11px] text-white/40">
              {state ? state.nodes.reduce((s, n) => s + n.size, 0) : 0} keys total
            </span>
          </div>
          <NodeBlocks
            nodes={state ? state.nodes : []}
            flash={flash}
            highlightKey={highlight ? highlight.key : null}
            primaryNode={highlight ? highlight.primary : null}
            replicaNodes={highlight ? (highlight.replicas || []) : []}
            onRemoveNode={handleRemoveNode}
          />
        </section>

        <footer className="text-[10px] text-white/30 mono uppercase tracking-[0.22em] text-center pt-6 pb-2 border-t border-white/5">
          node.js · express · next.js · tailwind · recharts · in-memory simulation
        </footer>
      </div>
    </main>
  );
}
