const { createTokenHash, parseCookies } = require('../utils/security');
const { getAdminSession } = require('../services/session-service');
const { isSafeMethod } = require('../utils/storefront');

function createRequireAdmin({ pool, env }) {
  return async (req, res, next) => {
    const admin = await getAdminSession(pool, env, req);
    if (!admin) return res.status(401).json({ error: 'Debe iniciar sesión para continuar.' });
    req.admin = admin;
    next();
  };
}

function createRequireCsrf({ env }) {
  return async (req, res, next) => {
    if (isSafeMethod(req.method)) return next();

    const cookies = parseCookies(req.headers.cookie || '');
    const csrfCookie = cookies[env.csrfCookieName] || cookies.admin_csrf || '';
    const csrfHeader = String(req.headers['x-csrf-token'] || '');

    if (!req.admin) {
      return res.status(403).json({ error: 'La validación CSRF falló.' });
    }

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({ error: 'La validación CSRF falló.' });
    }

    if (createTokenHash(csrfHeader) !== req.admin.csrfTokenHash) {
      return res.status(403).json({ error: 'La validación CSRF falló.' });
    }

    return next();
  };
}

module.exports = {
  createRequireAdmin,
  createRequireCsrf,
};
