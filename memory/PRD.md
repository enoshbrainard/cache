# Distributed Cache Simulator — PRD

## Original Problem Statement
Build a full-stack Distributed Cache Simulator that demonstrates how modern
caching systems (Redis Cluster style) distribute data across multiple cache
nodes using **consistent hashing**, with switchable **eviction strategies
(LRU / LFU)**, **TTL**, **replication**, **artificial latency**, and a live
**dashboard** for visualization.

## User Choices (2026-02-05)
- Tech stack: Node.js + Express (backend) + Next.js + Tailwind (frontend)
- Cache: in-memory simulation (no real Redis)
- Advanced features: ALL (ring viz, node add/remove, TTL, replication, logs panel)
- Auth: none (public sandbox)

## Architecture
- `/app/backend/node-cache/` — real Express service on internal port 8002
  - `services/HashRing.js` — md5-based ring with virtual nodes
  - `services/CacheNode.js` — LRU/LFU + TTL store
  - `services/Cluster.js` — orchestrates topology, replication, logs, rebalance
  - `controllers/*.js`, `routes/index.js`, `server.js`
- `/app/backend/server.py` — FastAPI ASGI proxy on port 8001 (supervisor pin)
  spawns the Node service and forwards `/api/*` traffic.
- `/app/frontend/` — Next.js 15 (App Router) at `/app/frontend/app/`
  - Dashboard composed of: HashRingViz (SVG), NodeBlocks, MetricsCharts
    (recharts), OpsPanel, ConfigPanel, LogsPanel, StatsBar.
  - Polls `/api/state`, `/api/metrics`, `/api/logs` every 1.5s for live UI.

## Personas
- Backend / system-design students: visualize how consistent hashing works
- Engineering interviewers: demo cluster topology + eviction concepts
- Distributed systems hobbyists: experiment with TTL, replication, latency

## Implemented Features (2026-02-05 — v1)
- POST /api/cache, GET /api/cache/:key, DELETE /api/cache/:key
- GET /api/lookup/:key (returns primary, replicas, ring angle)
- POST /api/config (policy, capacityPerNode, replicationFactor, latency, nodeCount)
- POST /api/nodes, DELETE /api/nodes/:id, POST /api/reset
- GET /api/metrics, GET /api/state, GET /api/ring, GET /api/logs, DELETE /api/logs
- LRU + LFU eviction with hot-swap
- TTL with expiry detection on read
- Replication factor (primary + replicas) with key migration on add/remove
- Artificial latency for realism
- Hash ring SVG with key-to-node animated chord
- Per-node block grid with hit/miss flash + per-key freq tooltip
- Hit/miss donut + requests-per-node bar chart
- Live event trace log with color-coded event types

## Iteration 2 (2026-02-05)
- Hit-rate-over-time line chart (60-sample rolling window, computed from
  delta hits/misses between polls).
- Animated key migration on node add/remove: backend now emits per-key
  `migrations: [{key, from, to, fromAngle, toAngle}]` inside REBALANCE and
  NODE_REMOVE log events; frontend animates dots flying along the ring
  from old node anchor → new node anchor (~900ms).

## Backlog
### P1
- Time-series chart of hit-rate over the last N minutes
- Highlight key migration animation (key flying from old node to new node on add/remove)
- Per-key TTL countdown progress bar inside node blocks

### P2
- Optional Redis backend toggle (real Redis instead of in-memory)
- Persistence fallback to MongoDB
- Replication consistency model toggle (sync vs async)
- Multiple "client" simulators with weighted key distributions for stress demos

## Test Status (2026-02-05, iteration 1)
- Backend pytest: 14/14 pass (100%)
- Frontend Playwright: 100% pass
- Test file: /app/backend/tests/test_cache_simulator.py

## Run / Verify
- Backend: served at `${REACT_APP_BACKEND_URL}/api/*` via FastAPI -> Express proxy
- Frontend: served at `${REACT_APP_BACKEND_URL}/` (Next.js dev)
- No credentials required.
