// Cluster orchestrates cache nodes, the consistent hash ring, replication, and
// observability (logs + metrics). Routes keys to nodes via the ring and
// applies the active eviction policy + TTL + optional artificial latency.

const { HashRing } = require('./HashRing');
const { CacheNode } = require('./CacheNode');

const DEFAULT_NODE_CAPACITY = 8;

class Cluster {
  constructor() {
    this.ring = new HashRing(40);
    this.nodes = new Map(); // id -> CacheNode
    this.policy = 'LRU';
    this.capacityPerNode = DEFAULT_NODE_CAPACITY;
    this.replicationFactor = 1; // 1 = no replicas; 2 = primary + 1 replica
    this.artificialLatencyMs = 0;
    this.logs = []; // ring buffer
    this.maxLogs = 200;
    this._nodeCounter = 0;

    // Seed with 3 nodes by default
    this.addNode();
    this.addNode();
    this.addNode();
  }

  _log(entry) {
    const evt = {
      ts: new Date().toISOString(),
      ...entry,
    };
    this.logs.unshift(evt);
    if (this.logs.length > this.maxLogs) this.logs.length = this.maxLogs;
    return evt;
  }

  async _maybeLatency() {
    if (this.artificialLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.artificialLatencyMs));
    }
  }

  _nextNodeId() {
    this._nodeCounter += 1;
    return `node-${this._nodeCounter}`;
  }

  addNode(id = null) {
    const nodeId = id || this._nextNodeId();
    if (this.nodes.has(nodeId)) return null;
    const node = new CacheNode(nodeId, this.capacityPerNode, this.policy);
    this.nodes.set(nodeId, node);
    this.ring.addNode(nodeId);
    this._log({ event: 'NODE_ADD', nodeId, message: `Added ${nodeId}` });
    this._rebalanceAfterTopologyChange('add', nodeId);
    return nodeId;
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return false;
    if (this.nodes.size <= 1) return false; // keep at least one
    const removedNode = this.nodes.get(nodeId);
    this.ring.removeNode(nodeId);
    this.nodes.delete(nodeId);
    // Re-route surviving keys from removed node to their new owners.
    let migrated = 0;
    for (const k of removedNode.listKeys()) {
      const entry = removedNode.store.get(k.key);
      if (!entry) continue;
      const owners = this.ring.getNodes(k.key, this.replicationFactor);
      const ttlRemaining = entry.expiresAt
        ? Math.max(0, entry.expiresAt - Date.now())
        : null;
      if (owners.length > 0) {
        const primary = owners[0];
        this.nodes.get(primary).replicaSet(k.key, entry.value, ttlRemaining);
        for (let i = 1; i < owners.length; i++) {
          this.nodes.get(owners[i]).replicaSet(k.key, entry.value, ttlRemaining);
        }
        migrated += 1;
      }
    }
    this._log({
      event: 'NODE_REMOVE',
      nodeId,
      message: `Removed ${nodeId}, migrated ${migrated} keys`,
    });
    return true;
  }

  _rebalanceAfterTopologyChange(kind, changedNodeId) {
    // After adding a node some keys might now belong to the new owner.
    // Move them to maintain consistency.
    let moved = 0;
    for (const node of this.nodes.values()) {
      const keys = node.listKeys().map((k) => k.key);
      for (const k of keys) {
        const owners = this.ring.getNodes(k, this.replicationFactor);
        if (owners.length === 0) continue;
        if (!owners.includes(node.id)) {
          // not an owner anymore; copy to actual owners then drop
          const entry = node.store.get(k);
          if (!entry) continue;
          const ttlRemaining = entry.expiresAt
            ? Math.max(0, entry.expiresAt - Date.now())
            : null;
          for (const owner of owners) {
            this.nodes.get(owner).replicaSet(k, entry.value, ttlRemaining);
          }
          node.replicaDelete(k);
          moved += 1;
        }
      }
    }
    if (moved > 0) {
      this._log({
        event: 'REBALANCE',
        message: `Rebalanced ${moved} keys after ${kind} of ${changedNodeId}`,
      });
    }
  }

  setPolicy(policy) {
    if (policy !== 'LRU' && policy !== 'LFU') {
      throw new Error('policy must be LRU or LFU');
    }
    this.policy = policy;
    for (const node of this.nodes.values()) node.setPolicy(policy);
    this._log({ event: 'CONFIG', message: `Eviction policy -> ${policy}` });
  }

  setCapacity(capacity) {
    this.capacityPerNode = capacity;
    for (const node of this.nodes.values()) node.setCapacity(capacity);
    this._log({ event: 'CONFIG', message: `Capacity per node -> ${capacity}` });
  }

  setReplicationFactor(rf) {
    const safe = Math.max(1, Math.min(rf, this.nodes.size));
    this.replicationFactor = safe;
    this._log({ event: 'CONFIG', message: `Replication factor -> ${safe}` });
  }

  setLatency(ms) {
    this.artificialLatencyMs = Math.max(0, ms);
    this._log({ event: 'CONFIG', message: `Artificial latency -> ${ms}ms` });
  }

  setNodeCount(target) {
    target = Math.max(1, Math.min(20, target));
    while (this.nodes.size < target) this.addNode();
    while (this.nodes.size > target) {
      const id = Array.from(this.nodes.keys()).pop();
      this.removeNode(id);
    }
  }

  async set(key, value, ttlMs = null) {
    await this._maybeLatency();
    const owners = this.ring.getNodes(key, this.replicationFactor);
    if (owners.length === 0) {
      this._log({ event: 'ERROR', key, message: 'No nodes available' });
      return { ok: false, error: 'no_nodes' };
    }
    const primaryId = owners[0];
    const primary = this.nodes.get(primaryId);
    const { evicted } = primary.set(key, value, ttlMs);
    for (let i = 1; i < owners.length; i++) {
      this.nodes.get(owners[i]).replicaSet(key, value, ttlMs);
    }
    this._log({
      event: 'SET',
      key,
      nodeId: primaryId,
      replicas: owners.slice(1),
      ttlMs,
      evicted,
      message: `SET ${key} -> ${primaryId}${evicted ? ` (evicted ${evicted})` : ''}`,
    });
    return { ok: true, primary: primaryId, replicas: owners.slice(1), evicted };
  }

  async get(key) {
    await this._maybeLatency();
    const owners = this.ring.getNodes(key, this.replicationFactor);
    if (owners.length === 0) return { ok: false, error: 'no_nodes' };
    const primaryId = owners[0];
    const primary = this.nodes.get(primaryId);
    const result = primary.get(key);
    this._log({
      event: result.hit ? 'HIT' : 'MISS',
      key,
      nodeId: primaryId,
      message: `GET ${key} @ ${primaryId} -> ${result.hit ? 'HIT' : 'MISS'}`,
    });
    return {
      ok: true,
      hit: result.hit,
      value: result.value,
      primary: primaryId,
      replicas: owners.slice(1),
      expired: result.expired || false,
    };
  }

  async delete(key) {
    await this._maybeLatency();
    const owners = this.ring.getNodes(key, this.replicationFactor);
    if (owners.length === 0) return { ok: false, error: 'no_nodes' };
    let any = false;
    for (const id of owners) {
      const ok = this.nodes.get(id).delete(key);
      any = any || ok;
    }
    this._log({
      event: 'DELETE',
      key,
      nodeId: owners[0],
      message: `DELETE ${key} from ${owners.join(', ')}`,
    });
    return { ok: true, deleted: any, owners };
  }

  whichNode(key) {
    const owners = this.ring.getNodes(key, this.replicationFactor);
    return { primary: owners[0] || null, replicas: owners.slice(1) };
  }

  metrics() {
    const perNode = {};
    let hits = 0;
    let misses = 0;
    let requests = 0;
    let sets = 0;
    let evictions = 0;
    for (const node of this.nodes.values()) {
      perNode[node.id] = {
        ...node.metrics,
        size: node.size(),
        capacity: node.capacity,
      };
      hits += node.metrics.hits;
      misses += node.metrics.misses;
      requests += node.metrics.requests;
      sets += node.metrics.sets;
      evictions += node.metrics.evictions;
    }
    const total = hits + misses;
    return {
      totals: {
        hits,
        misses,
        requests,
        sets,
        evictions,
        hitRate: total > 0 ? hits / total : 0,
      },
      perNode,
      config: {
        policy: this.policy,
        capacityPerNode: this.capacityPerNode,
        replicationFactor: this.replicationFactor,
        artificialLatencyMs: this.artificialLatencyMs,
        nodeCount: this.nodes.size,
      },
    };
  }

  state() {
    const nodes = [];
    for (const node of this.nodes.values()) nodes.push(node.snapshot());
    return {
      nodes,
      ring: this.ring.getRingState(),
      config: {
        policy: this.policy,
        capacityPerNode: this.capacityPerNode,
        replicationFactor: this.replicationFactor,
        artificialLatencyMs: this.artificialLatencyMs,
      },
    };
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  reset() {
    this.nodes.clear();
    this.ring = new HashRing(40);
    this._nodeCounter = 0;
    this.policy = 'LRU';
    this.capacityPerNode = DEFAULT_NODE_CAPACITY;
    this.replicationFactor = 1;
    this.artificialLatencyMs = 0;
    this.logs = [];
    this.addNode();
    this.addNode();
    this.addNode();
    this._log({ event: 'CONFIG', message: 'Cluster reset to defaults' });
  }
}

module.exports = { Cluster };
