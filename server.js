const fs = require('fs');
const path = require('path');
const express = require('express');

const { createEnv } = require('./src/config/env');
const { createPool } = require('./src/db/pool');
const { initDatabase } = require('./src/db/init');
const { securityHeaders } = require('./src/middleware/security-headers');
const { ensureReady } = require('./src/middleware/ensure-ready');
const { errorHandler } = require('./src/middleware/error-handler');
const { createPublicRouter, registerCheckoutRoute } = require('./src/routes/public-routes');
const { createAdminRouter } = require('./src/routes/admin-routes');
const { registerSpaRoutes } = require('./src/routes/spa-routes');
const { validateStrongPassword } = require('./src/utils/security');

const env = createEnv();
const pool = createPool(env);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

if (env.isProd) {
  const strongPassword = validateStrongPassword(env.adminPassword);
  if (!strongPassword.ok || env.adminPassword === 'ChangeMeNow_123!') {
    throw new Error('En producción debe definir ADMIN_PASSWORD con una contraseña fuerte y distinta del valor de ejemplo.');
  }
}

const ready = initDatabase(pool, env);

app.locals.env = env;
app.locals.pool = pool;
app.locals.ready = ready;

app.use(securityHeaders(env));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(ensureReady(ready));

app.get('/healthz', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/public', createPublicRouter({ pool, env }));
registerCheckoutRoute(app, { pool, env });
app.use('/api/admin', createAdminRouter({ pool, env }));

if (fs.existsSync(env.clientDistPath)) {
  app.use(
    express.static(env.clientDistPath, {
      maxAge: env.isProd ? '1h' : 0,
      index: false,
    })
  );
}

registerSpaRoutes(app, env);
app.use(errorHandler);

module.exports = app;
