const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const {
  sanitizeSettings,
  normalizeProduct,
  validatePaymentLink,
} = require('../utils/storefront');

function createPublicRouter({ pool, env }) {
  const router = express.Router();

  router.get('/settings', asyncHandler(async (_req, res) => {
    const result = await pool.query('SELECT * FROM store_settings WHERE id = 1 LIMIT 1');
    res.json(sanitizeSettings(result.rows[0] || null, env));
  }));

  router.get('/categories', asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'SELECT id, name, slug, description, is_active FROM categories WHERE is_active = TRUE ORDER BY name ASC'
    );
    res.json(result.rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })));
  }));

  router.get('/products', asyncHandler(async (req, res) => {
    const featuredOnly = String(req.query.featured || '').toLowerCase() === 'true';
    const clauses = ['p.is_active = TRUE'];
    if (featuredOnly) clauses.push('p.featured = TRUE');

    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY p.featured DESC, p.created_at DESC`
    );

    res.json(result.rows.map(normalizeProduct));
  }));

  router.get('/products/:slug', asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.is_active = TRUE
        LIMIT 1`,
      [req.params.slug]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    return res.json(normalizeProduct(result.rows[0]));
  }));

  return router;
}

function registerCheckoutRoute(app, { pool, env }) {
  app.get('/checkout/payment', asyncHandler(async (_req, res) => {
    const result = await pool.query('SELECT payment_link FROM store_settings WHERE id = 1 LIMIT 1');
    const payment = validatePaymentLink(result.rows[0]?.payment_link || '', env);

    if (!payment.ok || !payment.normalized) {
      return res.status(400).send('No se ha configurado un link de pago seguro.');
    }

    return res.redirect(payment.normalized);
  }));
}

module.exports = {
  createPublicRouter,
  registerCheckoutRoute,
};
