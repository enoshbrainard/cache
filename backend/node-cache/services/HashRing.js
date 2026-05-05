// Consistent Hashing Ring implementation with virtual nodes.
// Uses MD5 (first 8 hex chars -> 32-bit unsigned int) so the ring is
// deterministic and reproducible. The simulator visualizes key -> node
// placement based on this hash.

const crypto = require('crypto');

function hashKey(key) {
  // Use first 8 hex chars of md5 -> 32-bit unsigned int. Fast, well distributed,
  // good enough for visualization / simulation purposes.
  const h = crypto.createHash('md5').update(String(key)).digest('hex');
  return parseInt(h.substring(0, 8), 16);
}

class HashRing {
  constructor(virtualNodes = 40) {
    this.virtualNodes = virtualNodes;
    this.ring = []; // sorted [{ hash, nodeId }]
    this.nodes = new Set();
  }

  _resort() {
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  addNode(nodeId) {
    if (this.nodes.has(nodeId)) return;
    this.nodes.add(nodeId);
    for (let i = 0; i < this.virtualNodes; i++) {
      const vKey = `${nodeId}#vn${i}`;
      this.ring.push({ hash: hashKey(vKey), nodeId, vIndex: i });
    }
    this._resort();
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    this.nodes.delete(nodeId);
    this.ring = this.ring.filter((entry) => entry.nodeId !== nodeId);
  }

  // Return the primary node for a key (clockwise nearest).
  getNode(key) {
    if (this.ring.length === 0) return null;
    const h = hashKey(key);
    // binary search for first entry with hash >= h
    let lo = 0;
    let hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].hash < h) lo = mid + 1;
      else hi = mid;
    }
    const entry = this.ring[lo].hash >= h ? this.ring[lo] : this.ring[0];
    return entry.nodeId;
  }

  // Return up to `count` distinct nodes for replication (primary + replicas).
  getNodes(key, count = 1) {
    if (this.ring.length === 0) return [];
    const h = hashKey(key);
    let idx = 0;
    let lo = 0;
    let hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].hash < h) lo = mid + 1;
      else hi = mid;
    }
    idx = this.ring[lo].hash >= h ? lo : 0;
    const result = [];
    const seen = new Set();
    for (let i = 0; i < this.ring.length && result.length < count; i++) {
      const entry = this.ring[(idx + i) % this.ring.length];
      if (!seen.has(entry.nodeId)) {
        seen.add(entry.nodeId);
        result.push(entry.nodeId);
      }
    }
    return result;
  }

  getRingState() {
    // Return positions normalized to 0..1 for SVG plotting.
    const MAX = 0xffffffff;
    return this.ring.map((e) => ({
      nodeId: e.nodeId,
      hash: e.hash,
      angle: (e.hash / MAX) * 360,
      position: e.hash / MAX,
      vIndex: e.vIndex,
    }));
  }

  hashKeyAngle(key) {
    const MAX = 0xffffffff;
    const h = hashKey(key);
    return { hash: h, angle: (h / MAX) * 360, position: h / MAX };
  }

  listNodes() {
    return Array.from(this.nodes);
  }
}

module.exports = { HashRing, hashKey };
