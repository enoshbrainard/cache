// HTTP handlers for metrics + state + logs.

function makeMetricsController(cluster) {
  return {
    metrics(req, res) {
      return res.json(cluster.metrics());
    },
    state(req, res) {
      return res.json(cluster.state());
    },
    logs(req, res) {
      return res.json({ logs: cluster.getLogs() });
    },
    clearLogs(req, res) {
      cluster.clearLogs();
      return res.json({ ok: true });
    },
    ring(req, res) {
      return res.json({
        ring: cluster.ring.getRingState(),
        nodes: cluster.ring.listNodes(),
      });
    },
  };
}

module.exports = { makeMetricsController };
