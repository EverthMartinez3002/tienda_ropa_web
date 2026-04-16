const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { rateLimit } = require('../middleware/rate-limit');
const { createRequireAdmin, createRequireCsrf } = require('../middleware/auth');
const {
  verifyPassword,
  createPasswordHash,
  validateEmail,
  validateStrongPassword,
} = require('../utils/security');
const {
  cleanPayloadString,
  normalizeProduct,
  normalizeProductPayload,
  normalizeSettingsPayload,
  sanitizeAdminSettings,
} = require('../utils/storefront');
const {
  createAdminSession,
  deleteCurrentSession,
  clearSessionCookies,
  getAdminSession,
} = require('../services/session-service');
const { audit } = require('../services/audit-service');
const { createProductImageUpload, deleteUploadByUrl, imageUrlFromFile } = require('../services/upload-service');

function createAdminRouter({ pool, env }) {
  const router = express.Router();
  const requireAdmin = createRequireAdmin({ pool, env });
  const requireCsrf = createRequireCsrf({ env });
  const uploadProductImage = createProductImageUpload(env);

  router.post(
    '/login',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: 'admin-login' }),
    asyncHandler(async (req, res) => {
      const emailValidation = validateEmail(cleanPayloadString(req.body?.email || '', 180).toLowerCase());
      const password = String(req.body?.password || '');

      if (!emailValidation.ok) return res.status(400).json({ error: 'Correo inválido.' });
      if (!password) return res.status(400).json({ error: 'Debe ingresar la contraseña.' });

      const result = await pool.query(
        'SELECT id, name, email, password_hash FROM admins WHERE email = $1 LIMIT 1',
        [emailValidation.normalized]
      );

      const admin = result.rows[0];

      if (!admin || !verifyPassword(password, admin.password_hash)) {
        await audit(pool, null, 'login_failed', 'admin', null, req, { email: emailValidation.normalized });
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }

      await createAdminSession(pool, env, admin, req, res);
      await audit(pool, admin.id, 'login_success', 'admin', admin.id, req, {});
      return res.json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
    })
  );

  router.post(
    '/logout',
    asyncHandler(requireAdmin),
    asyncHandler(requireCsrf),
    asyncHandler(async (req, res) => {
      await deleteCurrentSession(pool, env, req);
      clearSessionCookies(res, env);
      await audit(pool, req.admin.id, 'logout', 'admin', req.admin.id, req, {});
      res.json({ ok: true });
    })
  );

  router.get('/session', asyncHandler(async (req, res) => {
    const admin = await getAdminSession(pool, env, req);
    if (!admin) return res.status(401).json({ error: 'No hay sesión activa.' });
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  }));

  router.get(
    '/dashboard',
    rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'admin-dashboard' }),
    asyncHandler(requireAdmin),
    asyncHandler(async (_req, res) => {
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
    })
  );

  router.get('/categories', asyncHandler(requireAdmin), asyncHandler(async (_req, res) => {
    const result = await pool.query('SELECT id, name, slug, description, is_active FROM categories ORDER BY created_at DESC');
    res.json(result.rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })));
  }));

  router.post('/categories', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const name = cleanPayloadString(req.body?.name || '', 120);
    const slug = require('../utils/security').slugify(req.body?.slug || name);
    const description = cleanPayloadString(req.body?.description || '', 400);
    const isActive = Boolean(req.body?.is_active ?? true);

    if (!name) return res.status(400).json({ error: 'Debe ingresar el nombre de la categoría.' });
    if (!slug) return res.status(400).json({ error: 'No se pudo generar un slug válido.' });

    const result = await pool.query(
      'INSERT INTO categories (name, slug, description, is_active, updated_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id',
      [name, slug, description, isActive]
    );

    await audit(pool, req.admin.id, 'category_create', 'category', result.rows[0].id, req, { name, slug });
    res.status(201).json({ ok: true, id: result.rows[0].id });
  }));

  router.put('/categories/:id', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const name = cleanPayloadString(req.body?.name || '', 120);
    const slug = require('../utils/security').slugify(req.body?.slug || name);
    const description = cleanPayloadString(req.body?.description || '', 400);
    const isActive = Boolean(req.body?.is_active ?? true);

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    if (!name) return res.status(400).json({ error: 'Debe ingresar el nombre de la categoría.' });
    if (!slug) return res.status(400).json({ error: 'No se pudo generar un slug válido.' });

    await pool.query(
      'UPDATE categories SET name=$1, slug=$2, description=$3, is_active=$4, updated_at=NOW() WHERE id=$5',
      [name, slug, description, isActive, id]
    );

    await audit(pool, req.admin.id, 'category_update', 'category', id, req, { name, slug });
    res.json({ ok: true });
  }));

  router.delete('/categories/:id', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    await audit(pool, req.admin.id, 'category_delete', 'category', id, req, {});
    res.json({ ok: true });
  }));

  router.post('/products/upload-image', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    await new Promise((resolve, reject) => {
      uploadProductImage(req, res, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    if (!req.file) return res.status(400).json({ error: 'Debe seleccionar una imagen.' });

    const imageUrl = imageUrlFromFile(req.file, env);
    await audit(pool, req.admin.id, 'product_image_upload', 'asset', req.file.filename, req, { image_url: imageUrl });
    res.status(201).json({ ok: true, image_url: imageUrl, filename: req.file.filename });
  }));

  router.get('/products', asyncHandler(requireAdmin), asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at DESC`
    );
    res.json(result.rows.map(normalizeProduct));
  }));

  router.post('/products', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const payload = normalizeProductPayload(req.body);
    if (!payload.ok) return res.status(400).json({ error: payload.error });
    const value = payload.value;

    const result = await pool.query(
      `INSERT INTO products
        (name, slug, category_id, price, compare_at_price, short_description, description, image_url, tag, sizes, featured, is_active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING id`,
      [
        value.name,
        value.slug,
        value.categoryId,
        value.price,
        value.compare,
        value.shortDescription,
        value.description,
        value.imageUrl,
        value.tag,
        value.sizes,
        value.featured,
        value.isActive,
      ]
    );

    await audit(pool, req.admin.id, 'product_create', 'product', result.rows[0].id, req, { name: value.name, slug: value.slug });
    res.status(201).json({ ok: true, id: result.rows[0].id });
  }));

  router.put('/products/:id', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    const payload = normalizeProductPayload(req.body);
    if (!payload.ok) return res.status(400).json({ error: payload.error });
    const value = payload.value;

    const currentProduct = await pool.query('SELECT image_url FROM products WHERE id = $1 LIMIT 1', [id]);

    await pool.query(
      `UPDATE products
          SET name=$1, slug=$2, category_id=$3, price=$4, compare_at_price=$5, short_description=$6, description=$7, image_url=$8, tag=$9, sizes=$10, featured=$11, is_active=$12, updated_at=NOW()
        WHERE id=$13`,
      [
        value.name,
        value.slug,
        value.categoryId,
        value.price,
        value.compare,
        value.shortDescription,
        value.description,
        value.imageUrl,
        value.tag,
        value.sizes,
        value.featured,
        value.isActive,
        id,
      ]
    );

    if (currentProduct.rows[0]?.image_url && currentProduct.rows[0].image_url !== value.imageUrl) {
      deleteUploadByUrl(currentProduct.rows[0].image_url, env);
    }

    await audit(pool, req.admin.id, 'product_update', 'product', id, req, { name: value.name, slug: value.slug });
    res.json({ ok: true });
  }));

  router.delete('/products/:id', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    const existing = await pool.query('SELECT image_url FROM products WHERE id = $1 LIMIT 1', [id]);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    deleteUploadByUrl(existing.rows[0]?.image_url || '', env);
    await audit(pool, req.admin.id, 'product_delete', 'product', id, req, {});
    res.json({ ok: true });
  }));

  router.get('/settings', asyncHandler(requireAdmin), asyncHandler(async (_req, res) => {
    const result = await pool.query('SELECT * FROM store_settings WHERE id = 1 LIMIT 1');
    res.json(sanitizeAdminSettings(result.rows[0] || null, env));
  }));

  router.put('/settings', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const payload = normalizeSettingsPayload(req.body, env);
    if (!payload.ok) return res.status(400).json({ error: payload.error });
    const value = payload.value;

    await pool.query(
      `UPDATE store_settings
          SET brand_name=$1, tagline=$2, whatsapp_number=$3, payment_link=$4, email=$5, instagram_url=$6, facebook_url=$7, shipping_note=$8, currency=$9, primary_color=$10, secondary_color=$11, accent_color=$12, updated_at=NOW()
        WHERE id = 1`,
      [
        value.brandName,
        value.tagline,
        value.whatsappNumber,
        value.paymentLink,
        value.email,
        value.instagramUrl,
        value.facebookUrl,
        value.shippingNote,
        value.currency,
        value.primaryColor,
        value.secondaryColor,
        value.accentColor,
      ]
    );

    await audit(pool, req.admin.id, 'settings_update', 'settings', 1, req, {
      brandName: value.brandName,
      email: value.email,
      whatsappNumber: value.whatsappNumber,
      instagramUrl: value.instagramUrl,
      facebookUrl: value.facebookUrl,
      primaryColor: value.primaryColor,
      secondaryColor: value.secondaryColor,
      accentColor: value.accentColor,
    });

    res.json({ ok: true });
  }));

  router.put('/change-password', asyncHandler(requireAdmin), asyncHandler(requireCsrf), asyncHandler(async (req, res) => {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');

    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Debe completar ambos campos.' });

    const strong = validateStrongPassword(newPassword);
    if (!strong.ok) return res.status(400).json({ error: strong.reason });

    const adminResult = await pool.query('SELECT id, password_hash FROM admins WHERE id = $1 LIMIT 1', [req.admin.id]);
    const admin = adminResult.rows[0];

    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      await audit(pool, req.admin.id, 'password_change_failed', 'admin', req.admin.id, req, { reason: 'invalid_current_password' });
      return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
    }

    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [createPasswordHash(newPassword), req.admin.id]);
    await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1', [req.admin.id]);
    clearSessionCookies(res, env);
    await audit(pool, req.admin.id, 'password_change_success', 'admin', req.admin.id, req, {});
    res.json({ ok: true });
  }));

  return router;
}

module.exports = { createAdminRouter };
