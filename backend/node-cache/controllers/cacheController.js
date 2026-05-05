// HTTP handlers for SET / GET / DELETE / lookup operations.

function makeCacheController(cluster) {
  return {
    async setKey(req, res) {
      const { key, value, ttlMs } = req.body || {};
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'key is required (string)' });
      }
      if (value === undefined) {
        return res.status(400).json({ error: 'value is required' });
      }
      const ttl = ttlMs && Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : null;
      const out = await cluster.set(key, value, ttl);
      return res.json(out);
    },

    async getKey(req, res) {
      const { key } = req.params;
      const out = await cluster.get(key);
      return res.json(out);
    },

    async deleteKey(req, res) {
      const { key } = req.params;
      const out = await cluster.delete(key);
      return res.json(out);
    },

    async whichNode(req, res) {
      const { key } = req.params;
      const out = cluster.whichNode(key);
      const angle = cluster.ring.hashKeyAngle(key);
      return res.json({ key, ...out, ...angle });
    },
  };
}

module.exports = { makeCacheController };
