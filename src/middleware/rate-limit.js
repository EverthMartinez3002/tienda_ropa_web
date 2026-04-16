const buckets = new Map();
const { getClientIp } = require('../services/audit-service');

function now() {
  return Date.now();
}

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const entry = buckets.get(key);
    const current = now();

    if (!entry || entry.resetAt <= current) {
      buckets.set(key, { count: 1, resetAt: current + windowMs });
      return next();
    }

    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - current) / 1000));
      return res.status(429).json({ error: 'Demasiados intentos. Espere un momento y vuelva a intentar.' });
    }

    entry.count += 1;
    return next();
  };
}

module.exports = { rateLimit };
