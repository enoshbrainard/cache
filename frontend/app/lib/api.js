// Lightweight API client for the cache simulator backend.
// All endpoints are mounted under /api on the same host as configured by
// NEXT_PUBLIC_BACKEND_URL (kubernetes ingress routes /api -> backend pod).

const BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  '';

async function http(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  state: () => http('/state'),
  metrics: () => http('/metrics'),
  ring: () => http('/ring'),
  logs: () => http('/logs'),
  clearLogs: () => http('/logs', { method: 'DELETE' }),
  setKey: (key, value, ttlMs) =>
    http('/cache', { method: 'POST', body: JSON.stringify({ key, value, ttlMs }) }),
  getKey: (key) => http(`/cache/${encodeURIComponent(key)}`),
  deleteKey: (key) =>
    http(`/cache/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  lookup: (key) => http(`/lookup/${encodeURIComponent(key)}`),
  config: (cfg) =>
    http('/config', { method: 'POST', body: JSON.stringify(cfg) }),
  addNode: () => http('/nodes', { method: 'POST' }),
  removeNode: (id) => http(`/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  reset: () => http('/reset', { method: 'POST' }),
};
