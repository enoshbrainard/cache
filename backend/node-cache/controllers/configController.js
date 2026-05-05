// HTTP handlers for cluster topology + eviction config.

function makeConfigController(cluster) {
  return {
    updateConfig(req, res) {
      const {
        policy,
        nodeCount,
        capacityPerNode,
        replicationFactor,
        artificialLatencyMs,
      } = req.body || {};
      try {
        if (policy) cluster.setPolicy(policy);
        if (Number.isFinite(nodeCount)) cluster.setNodeCount(Number(nodeCount));
        if (Number.isFinite(capacityPerNode))
          cluster.setCapacity(Number(capacityPerNode));
        if (Number.isFinite(replicationFactor))
          cluster.setReplicationFactor(Number(replicationFactor));
        if (Number.isFinite(artificialLatencyMs))
          cluster.setLatency(Number(artificialLatencyMs));
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      return res.json({ ok: true, config: cluster.metrics().config });
    },

    addNode(req, res) {
      const id = cluster.addNode();
      return res.json({ ok: true, nodeId: id });
    },

    removeNode(req, res) {
      const { id } = req.params;
      const ok = cluster.removeNode(id);
      if (!ok)
        return res
          .status(400)
          .json({ ok: false, error: 'cannot remove (unknown id or last node)' });
      return res.json({ ok: true, removed: id });
    },

    resetCluster(req, res) {
      cluster.reset();
      return res.json({ ok: true });
    },
  };
}

module.exports = { makeConfigController };
