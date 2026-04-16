const schemaSql = require('fs').readFileSync(require('path').join(process.cwd(), 'db', 'schema.sql'), 'utf8');
const {
  createPasswordHash,
  verifyPassword,
  validateStrongPassword,
  normalizeWhatsAppNumber,
} = require('../utils/security');

const DEFAULT_BRAND_NAME = 'Su marca';
const DEFAULT_WHATSAPP_NUMBER = '50370000000';
const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/su_tienda';
const DEFAULT_FACEBOOK_URL = 'https://www.facebook.com/su_tienda';
const DEFAULT_CONTACT_EMAIL = 'hola@su-tienda.com';
const DEFAULT_PRIMARY_COLOR = '#1F2D38';
const DEFAULT_SECONDARY_COLOR = '#DBC8B5';
const DEFAULT_ACCENT_COLOR = '#B78465';

async function ensureAdmin(pool, env) {
  const strongPassword = validateStrongPassword(env.adminPassword);
  if (!strongPassword.ok) {
    throw new Error(`ADMIN_PASSWORD no cumple la política mínima: ${strongPassword.reason}`);
  }

  const adminRows = await pool.query('SELECT id, email, password_hash FROM admins ORDER BY id ASC');

  if (adminRows.rows.length === 0) {
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
      [env.adminName, env.adminEmail, createPasswordHash(env.adminPassword)]
    );
    return;
  }

  const current = adminRows.rows.find((row) => String(row.email || '').trim().toLowerCase() === env.adminEmail);

  if (current) {
    if (!verifyPassword(env.adminPassword, current.password_hash)) {
      await pool.query('UPDATE admins SET name = $1, password_hash = $2 WHERE id = $3', [
        env.adminName,
        createPasswordHash(env.adminPassword),
        current.id,
      ]);
      await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1', [current.id]);
    }
    return;
  }

  if (adminRows.rows.length === 1) {
    const onlyAdmin = adminRows.rows[0];
    await pool.query('UPDATE admins SET name = $1, email = $2, password_hash = $3 WHERE id = $4', [
      env.adminName,
      env.adminEmail,
      createPasswordHash(env.adminPassword),
      onlyAdmin.id,
    ]);
    await pool.query('DELETE FROM admin_sessions WHERE admin_id = $1', [onlyAdmin.id]);
    return;
  }

  await pool.query(
    'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
    [env.adminName, env.adminEmail, createPasswordHash(env.adminPassword)]
  );
}

async function ensureSettings(pool, env) {
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM store_settings');
  if (count.rows[0].count > 0) return;

  const whatsapp = normalizeWhatsAppNumber(env.envWhatsAppNumber) || DEFAULT_WHATSAPP_NUMBER;
  const email = env.envContactEmail || DEFAULT_CONTACT_EMAIL;
  const instagramUrl = env.envInstagramUrl || DEFAULT_INSTAGRAM_URL;
  const facebookUrl = env.envFacebookUrl || DEFAULT_FACEBOOK_URL;

  await pool.query(
    `INSERT INTO store_settings
      (id, brand_name, tagline, whatsapp_number, payment_link, email, instagram_url, facebook_url, shipping_note, currency, primary_color, secondary_color, accent_color)
     VALUES
      (1, $1, $2, $3, $4, $5, $6, $7, $8, 'USD', $9, $10, $11)`,
    [
      env.brandName || DEFAULT_BRAND_NAME,
      'Piezas pensadas para vestir bonito todos los días.',
      whatsapp,
      env.defaultPaymentLink || 'https://example.com/pago',
      email,
      instagramUrl,
      facebookUrl,
      'Envíos en 24 a 48 horas hábiles a nivel nacional.',
      DEFAULT_PRIMARY_COLOR,
      DEFAULT_SECONDARY_COLOR,
      DEFAULT_ACCENT_COLOR,
    ]
  );
}

async function ensureCatalog(pool) {
  const categoryCount = await pool.query('SELECT COUNT(*)::int AS count FROM categories');
  if (categoryCount.rows[0].count === 0) {
    await pool.query(`
      INSERT INTO categories (name, slug, description) VALUES
      ('Camisas', 'camisas', 'Camisas ligeras y piezas de entrada elegantes.'),
      ('Vestidos', 'vestidos', 'Vestidos midi, fluidos y especiales para evento.'),
      ('Básicos', 'basicos', 'Piezas clave para un armario versátil.'),
      ('Sets', 'sets', 'Looks completos y fáciles de vender por conjunto.');
    `);
  }

  const productCount = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (productCount.rows[0].count > 0) return;

  const categories = await pool.query('SELECT id, slug FROM categories');
  const bySlug = Object.fromEntries(categories.rows.map((row) => [row.slug, row.id]));

  const products = [
    {
      name: 'Camisa Nube', slug: 'camisa-nube', category: 'camisas', price: 24.99, compare: 29.99,
      short: 'Camisa ligera con silueta relajada.',
      description: 'Una camisa fresca para combinar con faldas, jeans o pantalones sastre. Ideal para un catálogo femenino y moderno.',
      image: '/assets/products/camisa-nube.svg', tag: 'Nuevo', sizes: 'S,M,L', featured: true,
    },
    {
      name: 'Camisa Lino Arena', slug: 'camisa-lino-arena', category: 'camisas', price: 27.50, compare: 32.00,
      short: 'Textura suave y acabado natural.',
      description: 'Pieza pensada para outfits limpios y elegantes. Funciona bien como prenda casual o para oficina.',
      image: '/assets/products/camisa-lino.svg', tag: 'Top venta', sizes: 'M,L,XL', featured: true,
    },
    {
      name: 'Vestido Rosa Aura', slug: 'vestido-rosa-aura', category: 'vestidos', price: 39.90, compare: 45.00,
      short: 'Vestido midi con caída fluida.',
      description: 'Un diseño femenino, ligero y muy visual para destacar dentro del catálogo principal.',
      image: '/assets/products/vestido-rosa.svg', tag: 'Favorito', sizes: 'S,M,L', featured: true,
    },
    {
      name: 'Vestido Noche Celeste', slug: 'vestido-noche-celeste', category: 'vestidos', price: 44.00, compare: 52.00,
      short: 'Pieza especial para una línea más premium.',
      description: 'Vestido para una colección de salida elegante, ideal para elevar la percepción visual de la tienda.',
      image: '/assets/products/vestido-noche.svg', tag: 'Premium', sizes: 'S,M', featured: false,
    },
    {
      name: 'Pantalón Urbano', slug: 'pantalon-urbano', category: 'basicos', price: 31.99, compare: 37.00,
      short: 'Base versátil para múltiples looks.',
      description: 'Pantalón de línea limpia, combinable con camisas, tops y blazers.',
      image: '/assets/products/pantalon-urbano.svg', tag: 'Esencial', sizes: '6,8,10,12', featured: false,
    },
    {
      name: 'Set Blanco Serena', slug: 'set-blanco-serena', category: 'sets', price: 48.00, compare: 55.00,
      short: 'Look completo de dos piezas.',
      description: 'Set pensado para venta rápida por su versatilidad y aspecto premium.',
      image: '/assets/products/set-blanco.svg', tag: 'Look completo', sizes: 'S,M,L', featured: true,
    },
    {
      name: 'Chaqueta Soft Rose', slug: 'chaqueta-soft-rose', category: 'basicos', price: 36.50, compare: 42.00,
      short: 'Capa ligera para elevar un look casual.',
      description: 'Prenda adicional para temporadas frescas, ideal para enriquecer el ticket promedio.',
      image: '/assets/products/chaqueta-soft.svg', tag: 'Tendencia', sizes: 'M,L,XL', featured: false,
    },
    {
      name: 'Falda Midi Breeze', slug: 'falda-midi-breeze', category: 'basicos', price: 29.75, compare: 34.00,
      short: 'Falda de cintura alta y silueta fluida.',
      description: 'Una pieza funcional, femenina y fácil de combinar dentro de la colección base.',
      image: '/assets/products/falda-midi.svg', tag: 'Versátil', sizes: 'S,M,L', featured: false,
    },
  ];

  for (const product of products) {
    await pool.query(
      `INSERT INTO products
        (name, slug, category_id, price, compare_at_price, short_description, description, image_url, tag, sizes, featured, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)`,
      [
        product.name,
        product.slug,
        bySlug[product.category] || null,
        product.price,
        product.compare,
        product.short,
        product.description,
        product.image,
        product.tag,
        product.sizes,
        product.featured,
      ]
    );
  }
}

async function initDatabase(pool, env) {
  await pool.query(schemaSql);
  await pool.query("ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#1F2D38'");
  await pool.query("ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS secondary_color TEXT NOT NULL DEFAULT '#DBC8B5'");
  await pool.query("ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#B78465'");
  await pool.query("UPDATE store_settings SET primary_color = COALESCE(NULLIF(primary_color, ''), '#1F2D38'), secondary_color = COALESCE(NULLIF(secondary_color, ''), '#DBC8B5'), accent_color = COALESCE(NULLIF(accent_color, ''), '#B78465') WHERE id = 1");
  await pool.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()');
  await ensureAdmin(pool, env);
  await ensureSettings(pool, env);
  await ensureCatalog(pool);
}

module.exports = { initDatabase };
