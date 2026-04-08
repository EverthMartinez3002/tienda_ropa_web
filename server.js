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

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
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
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        adminId || null,
        action,
        entityType,
        entityId == null ? null : String(entityId),
        getClientIp(req),
        getUserAgent(req),
        JSON.stringify(details || {}),
      ]
    );
  } catch (error) {
    console.error('No se pudo registrar auditoría:', error.message);
  }
}

async function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const tokenHash = createTokenHash(token);
  const { rows } = await pool.query(
    `SELECT s.id AS session_id, s.admin_id, s.csrf_token_hash, a.name, a.email
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (!rows.length) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Sesión expirada' });
  }

  req.admin = { id: rows[0].admin_id, name: rows[0].name, email: rows[0].email };
  req.adminSession = rows[0];
  req.sessionToken = token;
  next();
}

function verifyAdminCsrf(req, res, next) {
  if (isSafeMethod(req.method)) return next();
  const cookies = parseCookies(req.headers.cookie || '');
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = String(req.headers['x-csrf-token'] || '');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'No se pudo validar la solicitud.' });
  }
  const incomingHash = createTokenHash(headerToken);
  if (incomingHash !== req.adminSession.csrf_token_hash) {
    return res.status(403).json({ error: 'No se pudo validar la solicitud.' });
  }
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', cspHeader());
  res.setHeader('Referrer-Policy', req.path.startsWith('/checkout/') ? 'no-referrer' : 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  if (req.path === '/admin' || req.path === '/admin.html' || req.path.startsWith('/api/admin')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'no-store');
  }
  if (req.path.startsWith('/api/public') || req.path.startsWith('/checkout/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/public/settings', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT brand_name, tagline, whatsapp_number, payment_link, email, instagram, shipping_note, currency FROM store_settings WHERE id = 1');
  res.json(sanitizeSettings(rows[0] || null));
}));

app.get('/api/public/categories', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.slug, c.description,
           COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
    WHERE c.is_active = TRUE
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  res.json(rows);
}));

app.get('/api/public/products', asyncRoute(async (req, res) => {
  const q = cleanPayloadString(req.query.q, 80);
  const category = cleanPayloadString(req.query.category, 60);
  const featured = String(req.query.featured || '');
  const params = [];
  let where = 'WHERE p.is_active = TRUE';

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (p.name ILIKE $${params.length} OR p.short_description ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
  }
  if (category && category !== 'all') {
    params.push(category);
    where += ` AND c.slug = $${params.length}`;
  }
  if (featured === 'true') {
    where += ' AND p.featured = TRUE';
  }

  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY p.featured DESC, p.created_at DESC`,
    params
  );
  res.json(rows.map(normalizeProduct));
}));

app.get('/api/public/products/:slug', asyncRoute(async (req, res) => {
  const slug = cleanPayloadString(req.params.slug, 140);
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.is_active = TRUE`,
    [slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(normalizeProduct(rows[0]));
}));

app.get('/checkout/payment', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT payment_link FROM store_settings WHERE id = 1');
  const validation = validatePaymentLink(rows[0]?.payment_link || '');
  if (!validation.ok || !validation.normalized) {
    return res.status(404).send('No hay link de pago configurado.');
  }
  res.redirect(302, validation.normalized);
}));

app.post('/api/admin/login', rateLimit({ windowMs: 10 * 60 * 1000, max: 8, keyPrefix: 'admin-login' }), asyncRoute(async (req, res) => {
  const emailValidation = validateEmail(req.body.email || '');
  const password = String(req.body.password || '');
  if (!emailValidation.ok || !password) {
    return res.status(400).json({ error: 'Credenciales inválidas' });
  }

  const { rows } = await pool.query('SELECT * FROM admins WHERE LOWER(email) = LOWER($1)', [emailValidation.normalized]);
  if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
    await audit(rows[0]?.id || null, 'login_failed', 'admin', rows[0]?.id || null, req, { email: emailValidation.normalized });
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const sessionToken = createRandomToken(32);
  const csrfToken = createRandomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1 OR expires_at <= NOW()', [rows[0].id]);
  await pool.query(
    `INSERT INTO admin_sessions (admin_id, token_hash, csrf_token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [rows[0].id, createTokenHash(sessionToken), createTokenHash(csrfToken), getClientIp(req), getUserAgent(req), expiresAt]
  );
  setSessionCookies(res, sessionToken, csrfToken);
  await audit(rows[0].id, 'login_success', 'admin', rows[0].id, req, {});
  res.json({ ok: true, admin: { id: rows[0].id, name: rows[0].name, email: rows[0].email } });
}));

app.post('/api/admin/logout', rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'admin-logout' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1', [req.admin.id]);
  clearSessionCookies(res);
  await audit(req.admin.id, 'logout', 'admin', req.admin.id, req, {});
  res.json({ ok: true });
}));

app.get('/api/admin/session', rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'admin-session' }), asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  res.json({ ok: true, admin: req.admin });
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

app.get('/api/admin/categories', rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'admin-categories-read' }), asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY created_at DESC');
  res.json(rows);
}));

app.post('/api/admin/categories', rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: 'admin-categories-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const name = cleanPayloadString(req.body.name, 120);
  const description = cleanPayloadString(req.body.description, 600);
  const slug = slugify(req.body.slug || name);
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const { rows } = await pool.query(
    'INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING *',
    [name, slug, description]
  );
  await audit(req.admin.id, 'category_create', 'category', rows[0].id, req, { name: rows[0].name, slug: rows[0].slug });
  res.status(201).json(rows[0]);
}));

app.put('/api/admin/categories/:id', rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: 'admin-categories-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const name = cleanPayloadString(req.body.name, 120);
  const description = cleanPayloadString(req.body.description, 600);
  const slug = slugify(req.body.slug || name);
  const isActive = req.body.is_active !== false;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const { rows } = await pool.query(
    `UPDATE categories
     SET name = $1, slug = $2, description = $3, is_active = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [name, slug, description, isActive, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
  await audit(req.admin.id, 'category_update', 'category', id, req, { name, slug, isActive });
  res.json(rows[0]);
}));

app.delete('/api/admin/categories/:id', rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: 'admin-categories-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('UPDATE products SET category_id = NULL, updated_at = NOW() WHERE category_id = $1', [id]);
  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  await audit(req.admin.id, 'category_delete', 'category', id, req, {});
  res.json({ ok: true });
}));

app.get('/api/admin/products', rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'admin-products-read' }), asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.created_at DESC`
  );
  res.json(rows.map(normalizeProduct));
}));

function validateProductPayload(body) {
  const name = cleanPayloadString(body.name, 120);
  if (!name) return { ok: false, reason: 'El nombre es obligatorio.' };

  const imageValidation = validateImageUrl(cleanPayloadString(body.image_url, 300));
  if (!imageValidation.ok) return { ok: false, reason: imageValidation.reason };

  const categoryId = body.category_id ? Number(body.category_id) : null;
  const price = Number(body.price || 0);
  const compareAtPrice = body.compare_at_price ? Number(body.compare_at_price) : null;
  if (!Number.isFinite(price) || price < 0) return { ok: false, reason: 'El precio no es válido.' };
  if (compareAtPrice != null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
    return { ok: false, reason: 'El precio anterior no es válido.' };
  }

  const sizes = Array.isArray(body.sizes)
    ? body.sizes.map((value) => cleanPayloadString(value, 20)).filter(Boolean).join(',')
    : cleanPayloadString(body.sizes, 120).split(',').map((value) => value.trim()).filter(Boolean).join(',');

  return {
    ok: true,
    value: {
      name,
      slug: slugify(body.slug || name),
      category_id: categoryId,
      price,
      compare_at_price: compareAtPrice,
      short_description: cleanPayloadString(body.short_description, 240),
      description: cleanPayloadString(body.description, 4000),
      image_url: imageValidation.normalized || '',
      tag: cleanPayloadString(body.tag, 40),
      sizes: sizes || 'S,M,L',
      featured: body.featured === true,
      is_active: body.is_active !== false,
    },
  };
}

app.post('/api/admin/products', rateLimit({ windowMs: 10 * 60 * 1000, max: 80, keyPrefix: 'admin-products-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const payload = validateProductPayload(req.body);
  if (!payload.ok) return res.status(400).json({ error: payload.reason });

  const p = payload.value;
  const { rows } = await pool.query(
    `INSERT INTO products
      (name, slug, category_id, price, compare_at_price, short_description, description, image_url, tag, sizes, featured, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [p.name, p.slug, p.category_id, p.price, p.compare_at_price, p.short_description, p.description, p.image_url, p.tag, p.sizes, p.featured, p.is_active]
  );
  await audit(req.admin.id, 'product_create', 'product', rows[0].id, req, { name: p.name, slug: p.slug });
  res.status(201).json(normalizeProduct(rows[0]));
}));

app.put('/api/admin/products/:id', rateLimit({ windowMs: 10 * 60 * 1000, max: 80, keyPrefix: 'admin-products-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const payload = validateProductPayload(req.body);
  if (!payload.ok) return res.status(400).json({ error: payload.reason });

  const p = payload.value;
  const { rows } = await pool.query(
    `UPDATE products
     SET name = $1, slug = $2, category_id = $3, price = $4, compare_at_price = $5,
         short_description = $6, description = $7, image_url = $8, tag = $9, sizes = $10,
         featured = $11, is_active = $12, updated_at = NOW()
     WHERE id = $13
     RETURNING *`,
    [p.name, p.slug, p.category_id, p.price, p.compare_at_price, p.short_description, p.description, p.image_url, p.tag, p.sizes, p.featured, p.is_active, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  await audit(req.admin.id, 'product_update', 'product', id, req, { name: p.name, slug: p.slug, is_active: p.is_active });
  res.json(normalizeProduct(rows[0]));
}));

app.delete('/api/admin/products/:id', rateLimit({ windowMs: 10 * 60 * 1000, max: 80, keyPrefix: 'admin-products-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
  await audit(req.admin.id, 'product_delete', 'product', id, req, {});
  res.json({ ok: true });
}));

app.get('/api/admin/settings', rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'admin-settings-read' }), asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM store_settings WHERE id = 1');
  res.json(rows[0] || null);
}));

app.put('/api/admin/settings', rateLimit({ windowMs: 10 * 60 * 1000, max: 40, keyPrefix: 'admin-settings-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const brand_name = cleanPayloadString(req.body.brand_name, 120);
  const tagline = cleanPayloadString(req.body.tagline, 220);
  const whatsapp = validateWhatsAppNumber(req.body.whatsapp_number || '');
  const payment = validatePaymentLink(cleanPayloadString(req.body.payment_link, 500));
  const email = validateEmail(req.body.email || '');
  const instagram = cleanPayloadString(req.body.instagram, 80).replace(/\s+/g, '');
  const shipping_note = cleanPayloadString(req.body.shipping_note, 240);
  const currency = cleanPayloadString(req.body.currency || 'USD', 10).toUpperCase() || 'USD';

  if (!brand_name) return res.status(400).json({ error: 'El nombre de marca es obligatorio.' });
  if (!tagline) return res.status(400).json({ error: 'El tagline es obligatorio.' });
  if (!whatsapp.ok) return res.status(400).json({ error: whatsapp.reason });
  if (!payment.ok) return res.status(400).json({ error: payment.reason });
  if (!email.ok) return res.status(400).json({ error: email.reason });

  const { rows } = await pool.query(
    `UPDATE store_settings
     SET brand_name = $1, tagline = $2, whatsapp_number = $3, payment_link = $4,
         email = $5, instagram = $6, shipping_note = $7, currency = $8, updated_at = NOW()
     WHERE id = 1 RETURNING *`,
    [brand_name, tagline, whatsapp.normalized, payment.normalized || '', email.normalized, instagram, shipping_note, currency]
  );
  await audit(req.admin.id, 'settings_update', 'store_settings', 1, req, { brand_name, currency });
  res.json(rows[0]);
}));

app.put('/api/admin/change-password', rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyPrefix: 'admin-password-write' }), asyncRoute(requireAdmin), verifyAdminCsrf, asyncRoute(async (req, res) => {
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');
  const strongPassword = validateStrongPassword(newPassword);
  if (!currentPassword || !strongPassword.ok) {
    return res.status(400).json({ error: strongPassword.reason || 'Revise los datos de contraseña.' });
  }

  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.admin.id]);
  if (!rows.length || !verifyPassword(currentPassword, rows[0].password_hash)) {
    await audit(req.admin.id, 'password_change_failed', 'admin', req.admin.id, req, {});
    return res.status(400).json({ error: 'La contraseña actual no es válida.' });
  }

  await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [createPasswordHash(newPassword), req.admin.id]);
  await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1', [req.admin.id]);
  clearSessionCookies(res);
  await audit(req.admin.id, 'password_change_success', 'admin', req.admin.id, req, {});
  res.json({ ok: true });
}));

app.get('/admin', (_req, res) => {
  res.redirect('/admin.html');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error interno.' });
});

(async () => {
  await initDb(pool);
  app.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
  });
})();
