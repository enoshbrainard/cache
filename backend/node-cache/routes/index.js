const express = require('express');
const { makeCacheController } = require('../controllers/cacheController');
const { makeConfigController } = require('../controllers/configController');
const { makeMetricsController } = require('../controllers/metricsController');

function buildRouter(cluster) {
  const router = express.Router();
  const cache = makeCacheController(cluster);
  const config = makeConfigController(cluster);
  const metrics = makeMetricsController(cluster);

  router.get('/health', (req, res) => res.json({ ok: true, service: 'cache-sim' }));

  // Cache ops
  router.post('/cache', cache.setKey);
  router.get('/cache/:key', cache.getKey);
  router.delete('/cache/:key', cache.deleteKey);
  router.get('/lookup/:key', cache.whichNode);

  // Config / topology
  router.post('/config', config.updateConfig);
  router.post('/nodes', config.addNode);
  router.delete('/nodes/:id', config.removeNode);
  router.post('/reset', config.resetCluster);

  // Observability
  router.get('/metrics', metrics.metrics);
  router.get('/state', metrics.state);
  router.get('/ring', metrics.ring);
  router.get('/logs', metrics.logs);
  router.delete('/logs', metrics.clearLogs);

  return router;
}

module.exports = { buildRouter };
