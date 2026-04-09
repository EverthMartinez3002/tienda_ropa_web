const crypto = require('crypto');

const SCRYPT_N = Number(process.env.SCRYPT_N || 1 << 15);
const SCRYPT_R = Number(process.env.SCRYPT_R || 8);
const SCRYPT_P = Number(process.env.SCRYPT_P || 1);
const SCRYPT_MAXMEM = Number(process.env.SCRYPT_MAXMEM || 256 * 1024 * 1024);
const PASSWORD_PEPPER = String(process.env.PASSWORD_PEPPER || '');
const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.MAX_PRODUCT_IMAGE_BYTES || 2 * 1024 * 1024);

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function hashPassword(password, salt) {
  const material = `${String(password)}${PASSWORD_PEPPER}`;
  return crypto.scryptSync(material, salt, 64, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }).toString('hex');
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;

  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 6) return false;
    const [, n, r, p, salt, originalHash] = parts;
    const candidate = crypto.scryptSync(`${String(password)}${PASSWORD_PEPPER}`, salt, 64, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    }).toString('hex');
    const a = Buffer.from(originalHash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (stored.includes(':')) {
    const [salt, originalHash] = stored.split(':');
    const candidate = hashPassword(password, salt);
    const a = Buffer.from(originalHash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  return false;
}

function createRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function createTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
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

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAllowedHosts(raw = '') {
  return String(raw)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameAllowed(hostname, allowedHosts = []) {
  if (!allowedHosts.length) return true;
  const host = String(hostname || '').toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function validateHttpUrl(value, { httpsOnly = true, allowedHosts = [] } = {}) {
  if (!value) return { ok: true, normalized: '' };
  try {
    const parsed = new URL(String(value));
    if (httpsOnly && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'La URL debe usar HTTPS.' };
    }
    if (!httpsOnly && !['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, reason: 'La URL debe usar HTTP o HTTPS.' };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, reason: 'La URL no puede incluir credenciales embebidas.' };
    }
    if (!hostnameAllowed(parsed.hostname, allowedHosts)) {
      return { ok: false, reason: 'El dominio no está permitido para este enlace.' };
    }
    return { ok: true, normalized: parsed.toString() };
  } catch (_error) {
    return { ok: false, reason: 'La URL no es válida.' };
  }
}

function validateImageDataUrl(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    return { ok: false, reason: 'La imagen debe ser PNG, JPG o WEBP.' };
  }

  try {
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buffer.length) {
      return { ok: false, reason: 'La imagen no contiene datos válidos.' };
    }
    if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
      return { ok: false, reason: `La imagen supera el máximo permitido de ${Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)} MB.` };
    }
    return { ok: true, normalized: `data:${match[1].toLowerCase()};base64,${match[2].replace(/\s+/g, '')}` };
  } catch (_error) {
    return { ok: false, reason: 'No se pudo procesar la imagen enviada.' };
  }
}

function validateImageUrl(value) {
  if (!value) return { ok: true, normalized: '' };
  const raw = String(value).trim();
  if (raw.startsWith('/')) return { ok: true, normalized: raw };
  if (/^data:image\//i.test(raw)) return validateImageDataUrl(raw);
  return validateHttpUrl(raw, { httpsOnly: true });
}

function normalizeWhatsAppNumber(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits;
}

function validateWhatsAppNumber(value = '') {
  const digits = normalizeWhatsAppNumber(value);
  if (!digits) return { ok: false, reason: 'El número de WhatsApp es obligatorio.' };
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, reason: 'El número de WhatsApp no parece válido.' };
  }
  return { ok: true, normalized: digits };
}

function validateEmail(value = '') {
  const email = String(value).trim().toLowerCase();
  if (!email) return { ok: false, reason: 'El correo es obligatorio.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'El correo no es válido.' };
  }
  return { ok: true, normalized: email };
}

function validateStrongPassword(password = '') {
  const value = String(password);
  if (value.length < 12) {
    return { ok: false, reason: 'La contraseña debe tener al menos 12 caracteres.' };
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return { ok: false, reason: 'La contraseña debe incluir mayúsculas, minúsculas y números.' };
  }
  return { ok: true };
}

function cleanText(value = '', max = 3000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

module.exports = {
  slugify,
  createPasswordHash,
  verifyPassword,
  createRandomToken,
  createTokenHash,
  parseCookies,
  normalizeAllowedHosts,
  validateHttpUrl,
  validateImageDataUrl,
  validateImageUrl,
  normalizeWhatsAppNumber,
  validateWhatsAppNumber,
  validateEmail,
  validateStrongPassword,
  cleanText,
  escapeRegExp,
};
