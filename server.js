const fs = require('fs');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const { initDb } = require('./lib/db');
const {
  parseCookies,
  verifyPassword,
  createPasswordHash,
  createRandomToken,
  createTokenHash,
  slugify,
  normalizeAllowedHosts,
  validateHttpUrl,
  validateImageUrl,
  validateWhatsAppNumber,
  validateEmail,
  validateStrongPassword,
  cleanText,
} = require('./lib/security');

const PORT = Number(process.env.PORT || 3000);
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tienda_ropa';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const PAYMENT_ALLOWED_HOSTS = normalizeAllowedHosts(process.env.PAYMENT_ALLOWED_HOSTS || '');
const SESSION_COOKIE_NAME = isProd ? '__Host-admin_session' : 'admin_session';
const CSRF_COOKIE_NAME = isProd ? '__Host-admin_csrf' : 'admin_csrf';

if (isProd) {
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const strongPassword = validateStrongPassword(adminPassword);
  if (!adminPassword || !strongPassword.ok || adminPassword === 'admin123' || adminPassword === 'ChangeMeNow_123!') {
    throw new Error('En producción debe definir ADMIN_PASSWORD con una contraseña fuerte y distinta del valor de ejemplo.');
  }
}

function shouldUseSsl(connectionString) {
  try {
    const url = new URL(connectionString);
    const host = String(url.hostname || '').toLowerCase();
    const sslmode = String(url.searchParams.get('sslmode') || '').toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1', 'db', 'postgres']);

    if (sslmode === 'disable') return false;
    if (localHosts.has(host) || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full') return true;
    return isProd;
  } catch (_error) {
    return isProd;
  }
}

const poolConfig = { connectionString: DATABASE_URL };
if (shouldUseSsl(DATABASE_URL)) poolConfig.ssl = { rejectUnauthorized: false };

const pool = new Pool(poolConfig);
const app = express();
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.disable('x-powered-by');
app.set('trust proxy', 1);

const rateBuckets = new Map();

function now() {
  return Date.now();
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 300);
}

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const bucketKey = `${keyPrefix}:${getClientIp(req)}`;
    const entry = rateBuckets.get(bucketKey);
    const current = now();
    if (!entry || entry.resetAt <= current) {
      rateBuckets.set(bucketKey, { count: 1, resetAt: current + windowMs });
      return next();
    }
    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - current) / 1000));
      return res.status(429).json({ error: 'Demasiados intentos. Espere un momento y vuelva a intentar.' });
    }
    entry.count += 1;
    next();
  };
}

function buildCookie(name, value, { maxAge = 0, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    httpOnly ? 'HttpOnly' : '',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    'Priority=High',
  ].filter(Boolean);
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function setSessionCookies(res, sessionToken, csrfToken) {
  const maxAge = SESSION_HOURS * 60 * 60;
  res.setHeader('Set-Cookie', [
    buildCookie(SESSION_COOKIE_NAME, sessionToken, { maxAge, httpOnly: true }),
    buildCookie(CSRF_COOKIE_NAME, csrfToken, { maxAge, httpOnly: false }),
  ]);
}

function clearSessionCookies(res) {
  res.setHeader('Set-Cookie', [
    buildCookie(SESSION_COOKIE_NAME, '', { maxAge: 0, httpOnly: true }),
    buildCookie(CSRF_COOKIE_NAME, '', { maxAge: 0, httpOnly: false }),
  ]);
}

function isSafeMethod(method = 'GET') {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase());
}

function cspHeader() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "connect-src 'self'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'self'",
  ];
  if (isProd) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function sanitizeSettings(row) {
  if (!row) return null;
  const paymentValidation = validatePaymentLink(row.payment_link || '');
  return {
    brand_name: row.brand_name,
    tagline: row.tagline,
    whatsapp_number: row.whatsapp_number,
    email: row.email,
    instagram: row.instagram,
    shipping_note: row.shipping_note,
    currency: row.currency,
    payment_enabled: paymentValidation.ok && Boolean(paymentValidation.normalized),
  };
}

function normalizeProduct(row) {
  return {
    ...row,
    price: Number(row.price || 0),
    compare_at_price: row.compare_at_price == null ? null : Number(row.compare_at_price),
    sizes: String(row.sizes || 'S,M,L').split(',').map((size) => size.trim()).filter(Boolean),
    featured: Boolean(row.featured),
    is_active: Boolean(row.is_active),
  };
}

function validatePaymentLink(rawUrl) {
  return validateHttpUrl(rawUrl, { httpsOnly: true, allowedHosts: PAYMENT_ALLOWED_HOSTS });
}

function cleanPayloadString(value, max = 500) {
  return cleanText(value, max);
}

async function audit(adminId, action, entityType, entityId, req, details = {}) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [adminId || null, action, entityType, entityId ? String(entityId) : null, getClientIp(req), getUserAgent(req), JSON.stringify(details || {})]
    );
  } catch (error) {
    console.error('No se pudo registrar la auditoría', error);
  }
}

async function getAdminSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies[SESSION_COOKIE_NAME] || cookies.admin_session;
  if (!sessionToken) return null;

  const result = await pool.query(
    `SELECT s.id, s.admin_id, s.expires_at, a.name, a.email
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1`,
    [createTokenHash(sessionToken)]
  );

  if (!result.rows[0]) return null;
  return {
    sessionId: result.rows[0].id,
    id: result.rows[0].admin_id,
    name: result.rows[0].name,
    email: result.rows[0].email,
  };
}

async function requireAdmin(req, res, next) {
  const admin = await getAdminSession(req);
  if (!admin) return res.status(401).json({ error: 'Debe iniciar sesión para continuar.' });
  req.admin = admin;
  return next();
}

function requireCsrf(req, res, next) {
  if (isSafeMethod(req.method)) return next();
  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies[CSRF_COOKIE_NAME] || cookies.admin_csrf;
  const csrfHeader = String(req.headers['x-csrf-token'] || '');
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'La validación CSRF falló.' });
  }
  return next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', cspHeader());
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  immutable: true,
  maxAge: isProd ? '7d' : 0,
  extensions: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'ico'],
}));

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: isProd ? '1h' : 0 }));
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/api/public/settings', asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT * FROM store_settings WHERE id = 1 LIMIT 1');
  res.json(sanitizeSettings(result.rows[0] || null));
}));

app.get('/api/public/categories', asyncRoute(async (_req, res) => {
  const result = await pool.query(
    'SELECT id, name, slug, description, is_active FROM categories WHERE is_active = TRUE ORDER BY name ASC'
  );
  res.json(result.rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })));
}));

app.get('/api/public/products', asyncRoute(async (req, res) => {
  const featuredOnly = String(req.query.featured || '').toLowerCase() === 'true';
  const params = [];
  let where = 'WHERE p.is_active = TRUE';

  if (featuredOnly) where += ' AND p.featured = TRUE';

  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.featured DESC, p.created_at DESC`,
    params
  );

  res.json(result.rows.map(normalizeProduct));
}));

app.get('/api/public/products/:slug', asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = $1 AND p.is_active = TRUE
      LIMIT 1`,
    [req.params.slug]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
  return res.json(normalizeProduct(result.rows[0]));
}));

app.get('/checkout/payment', asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT payment_link FROM store_settings WHERE id = 1 LIMIT 1');
  const validation = validatePaymentLink(result.rows[0]?.payment_link || '');
  if (!validation.ok || !validation.normalized) {
    return res.status(400).send('No se ha configurado un link de pago seguro.');
  }
  return res.redirect(validation.normalized);
}));

app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: 'admin-login' }), asyncRoute(async (req, res) => {
  const email = cleanPayloadString(req.body?.email || '', 180).toLowerCase();
  const password = String(req.body?.password || '');

  if (!validateEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (!password) return res.status(400).json({ error: 'Debe ingresar la contraseña.' });

  const result = await pool.query('SELECT id, name, email, password_hash FROM admins WHERE email = $1 LIMIT 1', [email]);
  const admin = result.rows[0];

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    await audit(null, 'login_failed', 'admin', null, req, { email });
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const sessionToken = createRandomToken(48);
  const csrfToken = createRandomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO admin_sessions (admin_id, token_hash, csrf_token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [admin.id, createTokenHash(sessionToken), createTokenHash(csrfToken), getClientIp(req), getUserAgent(req), expiresAt]
  );

  setSessionCookies(res, sessionToken, csrfToken);
  await audit(admin.id, 'login_success', 'admin', admin.id, req, {});
  res.json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
}));

app.post('/api/admin/logout', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies[SESSION_COOKIE_NAME] || cookies.admin_session;
  if (sessionToken) {
    await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [createTokenHash(sessionToken)]);
  }
  clearSessionCookies(res);
  await audit(req.admin.id, 'logout', 'admin', req.admin.id, req, {});
  res.json({ ok: true });
}));

app.get('/api/admin/session', asyncRoute(async (req, res) => {
  const admin = await getAdminSession(req);
  if (!admin) return res.status(401).json({ error: 'No hay sesión activa.' });
  res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
}));

app.get('/api/admin/dashboard', rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'admin-dashboard' }), asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const [products, categories, featured] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM products WHERE is_active = TRUE'),
    pool.query('SELECT COUNT(*)::int AS count FROM categories WHERE is_active = TRUE'),
    pool.query('SELECT COUNT(*)::int AS count FROM products WHERE is_active = TRUE AND featured = TRUE'),
  ]);

  res.json({
    total_products: products.rows[0].count,
    total_categories: categories.rows[0].count,
    featured_products: featured.rows[0].count,
  });
}));

app.get('/api/admin/categories', asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT id, name, slug, description, is_active FROM categories ORDER BY created_at DESC');
  res.json(result.rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })));
}));

app.post('/api/admin/categories', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const name = cleanPayloadString(req.body?.name || '', 120);
  const slug = slugify(req.body?.slug || name);
  const description = cleanPayloadString(req.body?.description || '', 400);
  const isActive = Boolean(req.body?.is_active ?? true);

  if (!name) return res.status(400).json({ error: 'Debe ingresar el nombre de la categoría.' });
  if (!slug) return res.status(400).json({ error: 'No se pudo generar un slug válido.' });

  const result = await pool.query(
    'INSERT INTO categories (name, slug, description, is_active, updated_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id',
    [name, slug, description, isActive]
  );

  await audit(req.admin.id, 'category_create', 'category', result.rows[0].id, req, { name, slug });
  res.status(201).json({ ok: true, id: result.rows[0].id });
}));

app.put('/api/admin/categories/:id', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const name = cleanPayloadString(req.body?.name || '', 120);
  const slug = slugify(req.body?.slug || name);
  const description = cleanPayloadString(req.body?.description || '', 400);
  const isActive = Boolean(req.body?.is_active ?? true);

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
  if (!name) return res.status(400).json({ error: 'Debe ingresar el nombre de la categoría.' });
  if (!slug) return res.status(400).json({ error: 'No se pudo generar un slug válido.' });

  await pool.query(
    'UPDATE categories SET name=$1, slug=$2, description=$3, is_active=$4, updated_at=NOW() WHERE id=$5',
    [name, slug, description, isActive, id]
  );

  await audit(req.admin.id, 'category_update', 'category', id, req, { name, slug });
  res.json({ ok: true });
}));

app.delete('/api/admin/categories/:id', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  await audit(req.admin.id, 'category_delete', 'category', id, req, {});
  res.json({ ok: true });
}));

function normalizeProductPayload(body) {
  const name = cleanPayloadString(body?.name || '', 180);
  const slug = slugify(body?.slug || name);
  const categoryIdRaw = body?.category_id;
  const categoryId = categoryIdRaw === '' || categoryIdRaw == null ? null : Number(categoryIdRaw);
  const price = Number(body?.price || 0);
  const compare = body?.compare_at_price === '' || body?.compare_at_price == null ? null : Number(body.compare_at_price);
  const shortDescription = cleanPayloadString(body?.short_description || '', 220);
  const description = cleanPayloadString(body?.description || '', 2000);
  const imageValidation = validateImageUrl(body?.image_url || '');
  const tag = cleanPayloadString(body?.tag || '', 80);
  const sizes = String(body?.sizes || 'S,M,L')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .join(',');
  const featured = Boolean(body?.featured);
  const isActive = Boolean(body?.is_active ?? true);

  if (!name) return { ok: false, error: 'Debe ingresar el nombre del producto.' };
  if (!slug) return { ok: false, error: 'No se pudo generar un slug válido.' };
  if (categoryId != null && (!Number.isInteger(categoryId) || categoryId <= 0)) return { ok: false, error: 'Categoría inválida.' };
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'El precio es inválido.' };
  if (compare != null && (!Number.isFinite(compare) || compare < 0)) return { ok: false, error: 'El precio anterior es inválido.' };
  if (!imageValidation.ok) return { ok: false, error: imageValidation.reason || 'La imagen es inválida.' };
  if (!sizes) return { ok: false, error: 'Debe indicar al menos una talla.' };

  return {
    ok: true,
    value: {
      name,
      slug,
      categoryId,
      price,
      compare,
      shortDescription,
      description,
      imageUrl: imageValidation.normalized,
      tag,
      sizes,
      featured,
      isActive,
    },
  };
}

app.get('/api/admin/products', asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC`
  );
  res.json(result.rows.map(normalizeProduct));
}));

app.post('/api/admin/products', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const payload = normalizeProductPayload(req.body);
  if (!payload.ok) return res.status(400).json({ error: payload.error });
  const value = payload.value;

  const result = await pool.query(
    `INSERT INTO products
      (name, slug, category_id, price, compare_at_price, short_description, description, image_url, tag, sizes, featured, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     RETURNING id`,
    [value.name, value.slug, value.categoryId, value.price, value.compare, value.shortDescription, value.description, value.imageUrl, value.tag, value.sizes, value.featured, value.isActive]
  );

  await audit(req.admin.id, 'product_create', 'product', result.rows[0].id, req, { name: value.name, slug: value.slug });
  res.status(201).json({ ok: true, id: result.rows[0].id });
}));

app.put('/api/admin/products/:id', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

  const payload = normalizeProductPayload(req.body);
  if (!payload.ok) return res.status(400).json({ error: payload.error });
  const value = payload.value;

  await pool.query(
    `UPDATE products
        SET name=$1, slug=$2, category_id=$3, price=$4, compare_at_price=$5, short_description=$6, description=$7, image_url=$8, tag=$9, sizes=$10, featured=$11, is_active=$12, updated_at=NOW()
      WHERE id=$13`,
    [value.name, value.slug, value.categoryId, value.price, value.compare, value.shortDescription, value.description, value.imageUrl, value.tag, value.sizes, value.featured, value.isActive, id]
  );

  await audit(req.admin.id, 'product_update', 'product', id, req, { name: value.name, slug: value.slug });
  res.json({ ok: true });
}));

app.delete('/api/admin/products/:id', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

  await pool.query('DELETE FROM products WHERE id = $1', [id]);
  await audit(req.admin.id, 'product_delete', 'product', id, req, {});
  res.json({ ok: true });
}));

app.get('/api/admin/settings', asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT * FROM store_settings WHERE id = 1 LIMIT 1');
  res.json(result.rows[0] || null);
}));

app.put('/api/admin/settings', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const brandName = cleanPayloadString(req.body?.brand_name || '', 120);
  const tagline = cleanPayloadString(req.body?.tagline || '', 240);
  const whatsappNumber = validateWhatsAppNumber(req.body?.whatsapp_number || '');
  const email = cleanPayloadString(req.body?.email || '', 180).toLowerCase();
  const instagram = cleanPayloadString(req.body?.instagram || '', 80);
  const shippingNote = cleanPayloadString(req.body?.shipping_note || '', 500);
  const currency = cleanPayloadString(req.body?.currency || 'USD', 12).toUpperCase();
  const paymentValidation = validatePaymentLink(req.body?.payment_link || '');

  if (!brandName) return res.status(400).json({ error: 'Debe ingresar el nombre de la marca.' });
  if (!tagline) return res.status(400).json({ error: 'Debe ingresar el tagline.' });
  if (!whatsappNumber.ok) return res.status(400).json({ error: whatsappNumber.reason || 'WhatsApp inválido.' });
  if (!validateEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (!paymentValidation.ok) return res.status(400).json({ error: paymentValidation.reason || 'Link de pago inválido.' });

  await pool.query(
    `UPDATE store_settings
        SET brand_name=$1, tagline=$2, whatsapp_number=$3, payment_link=$4, email=$5, instagram=$6, shipping_note=$7, currency=$8, updated_at=NOW()
      WHERE id = 1`,
    [brandName, tagline, whatsappNumber.normalized, paymentValidation.normalized, email, instagram, shippingNote, currency]
  );

  await audit(req.admin.id, 'settings_update', 'settings', 1, req, { brandName, email, instagram });
  res.json({ ok: true });
}));

app.put('/api/admin/change-password', asyncRoute(requireAdmin), requireCsrf, asyncRoute(async (req, res) => {
  const currentPassword = String(req.body?.current_password || '');
  const newPassword = String(req.body?.new_password || '');

  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Debe completar ambos campos.' });
  const strong = validateStrongPassword(newPassword);
  if (!strong.ok) return res.status(400).json({ error: strong.reason });

  const adminResult = await pool.query('SELECT id, password_hash FROM admins WHERE id = $1 LIMIT 1', [req.admin.id]);
  const admin = adminResult.rows[0];
  if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
    await audit(req.admin.id, 'password_change_failed', 'admin', req.admin.id, req, { reason: 'invalid_current_password' });
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
  }

  await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [createPasswordHash(newPassword), req.admin.id]);
  await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1', [req.admin.id]);
  clearSessionCookies(res);
  await audit(req.admin.id, 'password_change_success', 'admin', req.admin.id, req, {});
  res.json({ ok: true });
}));

app.get('/admin', (_req, res) => {
  res.redirect('/admin/login');
});

app.get('/admin.html', (_req, res) => {
  res.redirect('/admin/login');
});

app.get(/^\/(?!api\/|checkout\/).*/, (_req, res, next) => {
  const indexFile = path.join(frontendDist, 'index.html');
  if (!fs.existsSync(indexFile)) return next();
  res.sendFile(indexFile);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error interno.' });
});

(async () => {
  await initDb(pool);
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Servidor listo en http://localhost:${PORT}`);
    });
  }
})();

module.exports = app;
