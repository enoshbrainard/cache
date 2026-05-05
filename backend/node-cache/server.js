const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { Cluster } = require('./services/Cluster');
const { buildRouter } = require('./routes');

const PORT = parseInt(process.env.NODE_CACHE_PORT || '8002', 10);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const cluster = new Cluster();

// All API endpoints are mounted under /api as required by the platform ingress.
app.use('/api', buildRouter(cluster));

app.get('/', (req, res) => res.json({ service: 'distributed-cache-simulator' }));

app.use((err, req, res, _next) => {
  console.error('[cache-sim] error', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[cache-sim] listening on 127.0.0.1:${PORT}`);
});
