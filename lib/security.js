const crypto = require('crypto');

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(originalHash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return acc;
      const key = decodeURIComponent(part.slice(0, eq).trim());
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

module.exports = {
  slugify,
  createPasswordHash,
  verifyPassword,
  createSessionToken,
  parseCookies,
};
