const path = require('path');

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAllowedHosts(raw = '') {
  return String(raw)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function shouldUseSsl(connectionString, isProd) {
  try {
    const url = new URL(connectionString);
    const host = String(url.hostname || '').toLowerCase();
    const sslmode = String(url.searchParams.get('sslmode') || '').toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1', 'db', 'postgres']);

    if (sslmode === 'disable') return false;
    if (localHosts.has(host) || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (['require', 'verify-ca', 'verify-full'].includes(sslmode)) return true;
    return isProd;
  } catch (_error) {
    return isProd;
  }
}

function createEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const secureCookies = parseBoolean(process.env.SECURE_COOKIES, Boolean(process.env.VERCEL) || isProd);

  return {
    nodeEnv,
    isProd,
    port: parseInteger(process.env.PORT, 3000),
    sessionHours: parseInteger(process.env.SESSION_HOURS, 12),
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tienda_ropa',
    useSsl: shouldUseSsl(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tienda_ropa', isProd),
    secureCookies,
    sessionCookieName: isProd ? '__Host-admin_session' : 'admin_session',
    csrfCookieName: isProd ? '__Host-admin_csrf' : 'admin_csrf',
    paymentAllowedHosts: normalizeAllowedHosts(process.env.PAYMENT_ALLOWED_HOSTS || ''),
    adminName: String(process.env.ADMIN_NAME || 'Administrador').trim() || 'Administrador',
    adminEmail: String(process.env.ADMIN_EMAIL || 'admin@su-tienda.local').trim().toLowerCase(),
    adminPassword: String(process.env.ADMIN_PASSWORD || 'ChangeMeNow_123!'),
    passwordPepper: String(process.env.PASSWORD_PEPPER || ''),
    brandName: String(process.env.BRAND_NAME || 'Su marca').trim() || 'Su marca',
    defaultPaymentLink: String(process.env.DEFAULT_PAYMENT_LINK || 'https://example.com/pago').trim(),
    envWhatsAppNumber: String(process.env.WHATSAPP_NUMBER || '').trim(),
    envInstagramUrl: String(process.env.INSTAGRAM_URL || '').trim(),
    envFacebookUrl: String(process.env.FACEBOOK_URL || '').trim(),
    envContactEmail: String(process.env.CONTACT_EMAIL || '').trim().toLowerCase(),
    clientDistPath: path.join(process.cwd(), 'dist', 'client'),
  };
}

module.exports = { createEnv };
