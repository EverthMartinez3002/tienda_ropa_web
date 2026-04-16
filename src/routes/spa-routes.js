const fs = require('fs');
const path = require('path');

function registerSpaRoutes(app, env) {
  const indexFile = path.join(env.clientDistPath, 'index.html');

  app.get('/admin', (_req, res) => {
    res.redirect('/admin/login');
  });

  app.get(/^\/(?!api\/|checkout\/|healthz$).*/, (_req, res, next) => {
    if (!fs.existsSync(indexFile)) {
      return res.status(500).send('El frontend no ha sido compilado todavía. Ejecute npm run build.');
    }
    return res.sendFile(indexFile);
  });
}

module.exports = { registerSpaRoutes };
