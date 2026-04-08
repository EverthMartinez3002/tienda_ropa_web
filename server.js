const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const { initDb } = require('./lib/db');
const { parseCookies, verifyPassword, createPasswordHash, createSessionToken, slugify } = require('./lib/security');

const PORT = Number(process.env.PORT || 3000);
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tienda_ropa';
const isProd = process.env.NODE_ENV === 'production';

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const parts = [
    `admin_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [
    'admin_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
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

async function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.admin_session;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.email
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (!rows.length) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sesión expirada' });
  }

  req.admin = rows[0];
  req.sessionToken = token;
  next();
}

app.get('/api/public/settings', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT brand_name, tagline, whatsapp_number, payment_link, email, instagram, shipping_note, currency FROM store_settings WHERE id = 1');
  res.json(rows[0] || null);
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
  const { q = '', category = '', featured = '' } = req.query;
  const params = [];
  let where = 'WHERE p.is_active = TRUE';

  if (q) {
    params.push(`%${String(q).trim()}%`);
    where += ` AND (p.name ILIKE $${params.length} OR p.short_description ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
  }
  if (category && category !== 'all') {
    params.push(String(category));
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
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.is_active = TRUE`,
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(normalizeProduct(rows[0]));
}));

app.post('/api/admin/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const { rows } = await pool.query('SELECT * FROM admins WHERE LOWER(email) = LOWER($1)', [email]);
  if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES ($1, $2, $3)', [rows[0].id, token, expiresAt]);
  setSessionCookie(res, token);
  res.json({ ok: true, admin: { id: rows[0].id, name: rows[0].name, email: rows[0].email } });
}));

app.post('/api/admin/logout', asyncRoute(async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.admin_session) {
    await pool.query('DELETE FROM admin_sessions WHERE token = $1', [cookies.admin_session]);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/api/admin/session', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  res.json({ ok: true, admin: req.admin });
}));

app.get('/api/admin/dashboard', asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const [[products], [categories], [featured]] = await Promise.all([
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
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY created_at DESC');
  res.json(rows);
}));

app.post('/api/admin/categories', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const slug = slugify(req.body.slug || name);
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const { rows } = await pool.query(
    'INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING *',
    [name, slug, description]
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/admin/categories/:id', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
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
  res.json(rows[0]);
}));

app.delete('/api/admin/categories/:id', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('UPDATE products SET category_id = NULL, updated_at = NOW() WHERE category_id = $1', [id]);
  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  res.json({ ok: true });
}));

app.get('/api/admin/products', asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.created_at DESC`
  );
  res.json(rows.map(normalizeProduct));
}));

app.post('/api/admin/products', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const slug = slugify(req.body.slug || name);
  const categoryId = req.body.category_id ? Number(req.body.category_id) : null;
  const price = Number(req.body.price || 0);
  const compare = req.body.compare_at_price ? Number(req.body.compare_at_price) : null;
  const short = String(req.body.short_description || '').trim();
  const description = String(req.body.description || '').trim();
  const imageUrl = String(req.body.image_url || '').trim();
  const tag = String(req.body.tag || '').trim();
  const sizes = Array.isArray(req.body.sizes)
    ? req.body.sizes.join(',')
    : String(req.body.sizes || '').split(',').map((s) => s.trim()).filter(Boolean).join(',');
  const featured = req.body.featured === true;
  const isActive = req.body.is_active !== false;

  const { rows } = await pool.query(
    `INSERT INTO products
      (name, slug, category_id, price, compare_at_price, short_description, description, image_url, tag, sizes, featured, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [name, slug, categoryId, price, compare, short, description, imageUrl, tag, sizes || 'S,M,L', featured, isActive]
  );
  res.status(201).json(normalizeProduct(rows[0]));
}));

app.put('/api/admin/products/:id', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const slug = slugify(req.body.slug || name);
  const categoryId = req.body.category_id ? Number(req.body.category_id) : null;
  const price = Number(req.body.price || 0);
  const compare = req.body.compare_at_price ? Number(req.body.compare_at_price) : null;
  const short = String(req.body.short_description || '').trim();
  const description = String(req.body.description || '').trim();
  const imageUrl = String(req.body.image_url || '').trim();
  const tag = String(req.body.tag || '').trim();
  const sizes = Array.isArray(req.body.sizes)
    ? req.body.sizes.join(',')
    : String(req.body.sizes || '').split(',').map((s) => s.trim()).filter(Boolean).join(',');
  const featured = req.body.featured === true;
  const isActive = req.body.is_active !== false;

  const { rows } = await pool.query(
    `UPDATE products
     SET name = $1, slug = $2, category_id = $3, price = $4, compare_at_price = $5,
         short_description = $6, description = $7, image_url = $8, tag = $9, sizes = $10,
         featured = $11, is_active = $12, updated_at = NOW()
     WHERE id = $13
     RETURNING *`,
    [name, slug, categoryId, price, compare, short, description, imageUrl, tag, sizes || 'S,M,L', featured, isActive, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(normalizeProduct(rows[0]));
}));

app.delete('/api/admin/products/:id', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.get('/api/admin/settings', asyncRoute(requireAdmin), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM store_settings WHERE id = 1');
  res.json(rows[0] || null);
}));

app.put('/api/admin/settings', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const payload = {
    brand_name: String(req.body.brand_name || '').trim(),
    tagline: String(req.body.tagline || '').trim(),
    whatsapp_number: String(req.body.whatsapp_number || '').trim(),
    payment_link: String(req.body.payment_link || '').trim(),
    email: String(req.body.email || '').trim(),
    instagram: String(req.body.instagram || '').trim(),
    shipping_note: String(req.body.shipping_note || '').trim(),
    currency: String(req.body.currency || 'USD').trim() || 'USD',
  };

  const { rows } = await pool.query(
    `UPDATE store_settings
     SET brand_name = $1, tagline = $2, whatsapp_number = $3, payment_link = $4,
         email = $5, instagram = $6, shipping_note = $7, currency = $8, updated_at = NOW()
     WHERE id = 1 RETURNING *`,
    [payload.brand_name, payload.tagline, payload.whatsapp_number, payload.payment_link, payload.email, payload.instagram, payload.shipping_note, payload.currency]
  );
  res.json(rows[0]);
}));

app.put('/api/admin/change-password', asyncRoute(requireAdmin), asyncRoute(async (req, res) => {
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Revise los datos de contraseña' });
  }

  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.admin.id]);
  if (!rows.length || !verifyPassword(currentPassword, rows[0].password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual no es válida' });
  }

  await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [createPasswordHash(newPassword), req.admin.id]);
  res.json({ ok: true });
}));

app.get('/admin', (_req, res) => {
  res.redirect('/admin.html');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error interno' });
});

(async () => {
  await initDb(pool);
  app.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
  });
})();
