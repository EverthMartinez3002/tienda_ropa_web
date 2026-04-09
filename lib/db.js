const { createPasswordHash, validateStrongPassword } = require('./security');

const DEFAULT_BRAND_NAME = 'Su marca';

async function initDb(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Administrador',
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE,
      csrf_token_hash TEXT,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      compare_at_price NUMERIC(10,2),
      short_description TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      sizes TEXT NOT NULL DEFAULT 'XS,S,M,L',
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      brand_name TEXT NOT NULL DEFAULT 'Su marca',
      tagline TEXT NOT NULL DEFAULT 'Piezas pensadas para vestir bonito todos los días.',
      whatsapp_number TEXT NOT NULL DEFAULT '50370000000',
      payment_link TEXT NOT NULL DEFAULT 'https://example.com/pago',
      email TEXT NOT NULL DEFAULT 'hola@su-tienda.com',
      instagram TEXT NOT NULL DEFAULT '@su_tienda',
      shipping_note TEXT NOT NULL DEFAULT 'Envíos en 24 a 48 horas hábiles a nivel nacional.',
      currency TEXT NOT NULL DEFAULT 'USD',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT`);
  await pool.query(`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT`);
  await pool.query(`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT`);
  await pool.query(`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT`);
  await pool.query(`DELETE FROM admin_sessions WHERE expires_at <= NOW() OR token_hash IS NULL OR csrf_token_hash IS NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_token_hash_idx ON admin_sessions(token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_sessions_admin_id_idx ON admin_sessions(admin_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx ON admin_audit_logs(admin_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS products_slug_idx ON products(slug)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id)`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@su-tienda.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMeNow_123!';
  const strongPassword = validateStrongPassword(adminPassword);
  if (!strongPassword.ok) {
    throw new Error(`ADMIN_PASSWORD no cumple la política mínima: ${strongPassword.reason}`);
  }

  const adminCount = await pool.query('SELECT COUNT(*)::int AS count FROM admins');
  if (adminCount.rows[0].count === 0) {
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
      ['Administrador', adminEmail, createPasswordHash(adminPassword)]
    );
  }

  const settings = await pool.query('SELECT COUNT(*)::int AS count FROM store_settings');
  if (settings.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO store_settings (id, brand_name, tagline, whatsapp_number, payment_link, email, instagram, shipping_note, currency)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, 'USD')`,
      [
        process.env.BRAND_NAME || DEFAULT_BRAND_NAME,
        'Piezas pensadas para vestir bonito todos los días.',
        '50370000000',
        'https://example.com/pago',
        'hola@su-tienda.com',
        '@su_tienda',
        'Envíos en 24 a 48 horas hábiles a nivel nacional.',
      ]
    );
  }

  const envBrandName = String(process.env.BRAND_NAME || '').trim();
  if (envBrandName) {
    const currentSettings = await pool.query('SELECT brand_name FROM store_settings WHERE id = 1 LIMIT 1');
    const currentBrandName = String(currentSettings.rows[0]?.brand_name || '').trim();
    if (!currentBrandName || currentBrandName === DEFAULT_BRAND_NAME) {
      await pool.query('UPDATE store_settings SET brand_name = $1, updated_at = NOW() WHERE id = 1', [envBrandName]);
    }
  }

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
  if (productCount.rows[0].count === 0) {
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
        name: 'Camisa Lino Arena', slug: 'camisa-lino-arena', category: 'camisas', price: 27.5, compare: 32,
        short: 'Textura suave y acabado natural.',
        description: 'Pieza pensada para outfits limpios y elegantes. Funciona bien como prenda casual o para oficina.',
        image: '/assets/products/camisa-lino.svg', tag: 'Top venta', sizes: 'M,L,XL', featured: true,
      },
      {
        name: 'Vestido Rosa Aura', slug: 'vestido-rosa-aura', category: 'vestidos', price: 39.9, compare: 45,
        short: 'Vestido midi con caída fluida.',
        description: 'Un diseño femenino, ligero y muy visual para destacar dentro del catálogo principal.',
        image: '/assets/products/vestido-rosa.svg', tag: 'Favorito', sizes: 'S,M,L', featured: true,
      },
      {
        name: 'Vestido Noche Celeste', slug: 'vestido-noche-celeste', category: 'vestidos', price: 44, compare: 52,
        short: 'Pieza especial para una línea más premium.',
        description: 'Vestido para una colección de salida elegante, ideal para elevar la percepción visual de la tienda.',
        image: '/assets/products/vestido-noche.svg', tag: 'Premium', sizes: 'S,M', featured: false,
      },
      {
        name: 'Pantalón Urbano', slug: 'pantalon-urbano', category: 'basicos', price: 31.99, compare: 37,
        short: 'Base versátil para múltiples looks.',
        description: 'Pantalón de línea limpia, combinable con camisas, tops y blazers.',
        image: '/assets/products/pantalon-urbano.svg', tag: 'Esencial', sizes: '6,8,10,12', featured: false,
      },
      {
        name: 'Set Blanco Serena', slug: 'set-blanco-serena', category: 'sets', price: 48, compare: 55,
        short: 'Look completo de dos piezas.',
        description: 'Set pensado para venta rápida por su versatilidad y aspecto premium.',
        image: '/assets/products/set-blanco.svg', tag: 'Look completo', sizes: 'S,M,L', featured: true,
      },
      {
        name: 'Chaqueta Soft Rose', slug: 'chaqueta-soft-rose', category: 'basicos', price: 36.5, compare: 42,
        short: 'Capa ligera para elevar un look casual.',
        description: 'Prenda adicional para temporadas frescas, ideal para enriquecer el ticket promedio.',
        image: '/assets/products/chaqueta-soft.svg', tag: 'Tendencia', sizes: 'M,L,XL', featured: false,
      },
      {
        name: 'Falda Midi Breeze', slug: 'falda-midi-breeze', category: 'basicos', price: 29.75, compare: 34,
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
}

module.exports = { initDb };
