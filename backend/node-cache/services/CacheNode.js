// A single cache node with pluggable eviction (LRU / LFU) + TTL support.

class CacheNode {
  constructor(id, capacity = 8, policy = 'LRU') {
    this.id = id;
    this.capacity = capacity;
    this.policy = policy; // 'LRU' | 'LFU'
    // Map preserves insertion order which we leverage for LRU recency.
    this.store = new Map(); // key -> { value, expiresAt, freq, lastAccess }
    this.metrics = {
      hits: 0,
      misses: 0,
      requests: 0,
      sets: 0,
      evictions: 0,
    };
  }

  setPolicy(policy) {
    if (policy !== 'LRU' && policy !== 'LFU') return;
    this.policy = policy;
  }

  setCapacity(capacity) {
    this.capacity = capacity;
    while (this.store.size > this.capacity) this._evictOne();
  }

  _now() {
    return Date.now();
  }

  _isExpired(entry) {
    return entry.expiresAt && entry.expiresAt < this._now();
  }

  _touchOnAccess(key, entry) {
    entry.lastAccess = this._now();
    entry.freq += 1;
    if (this.policy === 'LRU') {
      // re-insert to move to most-recent end
      this.store.delete(key);
      this.store.set(key, entry);
    }
  }

  _evictOne() {
    if (this.store.size === 0) return null;
    let evictKey = null;
    if (this.policy === 'LRU') {
      // First inserted = least-recent
      evictKey = this.store.keys().next().value;
    } else {
      // LFU: lowest freq, tiebreak by oldest lastAccess
      let best = null;
      for (const [k, v] of this.store.entries()) {
        if (
          best === null ||
          v.freq < best.freq ||
          (v.freq === best.freq && v.lastAccess < best.lastAccess)
        ) {
          best = { key: k, freq: v.freq, lastAccess: v.lastAccess };
        }
      }
      evictKey = best ? best.key : null;
    }
    if (evictKey !== null) {
      this.store.delete(evictKey);
      this.metrics.evictions += 1;
    }
    return evictKey;
  }

  set(key, value, ttlMs = null) {
    this.metrics.requests += 1;
    this.metrics.sets += 1;
    const expiresAt = ttlMs && ttlMs > 0 ? this._now() + ttlMs : null;
    if (this.store.has(key)) {
      const existing = this.store.get(key);
      existing.value = value;
      existing.expiresAt = expiresAt;
      existing.lastAccess = this._now();
      existing.freq += 1;
      if (this.policy === 'LRU') {
        this.store.delete(key);
        this.store.set(key, existing);
      }
      return { evicted: null };
    }
    let evicted = null;
    if (this.store.size >= this.capacity) {
      evicted = this._evictOne();
    }
    this.store.set(key, {
      value,
      expiresAt,
      freq: 1,
      lastAccess: this._now(),
    });
    return { evicted };
  }

  get(key) {
    this.metrics.requests += 1;
    const entry = this.store.get(key);
    if (!entry) {
      this.metrics.misses += 1;
      return { hit: false, value: null };
    }
    if (this._isExpired(entry)) {
      this.store.delete(key);
      this.metrics.misses += 1;
      return { hit: false, value: null, expired: true };
    }
    this._touchOnAccess(key, entry);
    this.metrics.hits += 1;
    return { hit: true, value: entry.value, expiresAt: entry.expiresAt };
  }

  // Read without affecting metrics; used for replica reads / inspection.
  peek(key) {
    const entry = this.store.get(key);
    if (!entry || this._isExpired(entry)) return null;
    return { value: entry.value, expiresAt: entry.expiresAt };
  }

  delete(key) {
    this.metrics.requests += 1;
    return this.store.delete(key);
  }

  // Used by replication path to silently store a copy.
  replicaSet(key, value, ttlMs = null) {
    const expiresAt = ttlMs && ttlMs > 0 ? this._now() + ttlMs : null;
    if (this.store.has(key)) {
      const existing = this.store.get(key);
      existing.value = value;
      existing.expiresAt = expiresAt;
      return;
    }
    if (this.store.size >= this.capacity) this._evictOne();
    this.store.set(key, {
      value,
      expiresAt,
      freq: 0,
      lastAccess: this._now(),
    });
  }

  replicaDelete(key) {
    this.store.delete(key);
  }

  listKeys() {
    const now = this._now();
    const keys = [];
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt && v.expiresAt < now) continue;
      keys.push({
        key: k,
        freq: v.freq,
        lastAccess: v.lastAccess,
        expiresAt: v.expiresAt,
        ttlRemaining: v.expiresAt ? Math.max(0, v.expiresAt - now) : null,
      });
    }
    return keys;
  }

  size() {
    return this.store.size;
  }

  resetMetrics() {
    this.metrics = { hits: 0, misses: 0, requests: 0, sets: 0, evictions: 0 };
  }

  snapshot() {
    return {
      id: this.id,
      capacity: this.capacity,
      policy: this.policy,
      size: this.size(),
      metrics: { ...this.metrics },
      keys: this.listKeys(),
    };
  }
}

module.exports = { CacheNode };
