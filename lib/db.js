const { createPasswordHash } = require('./security');

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
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
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
      brand_name TEXT NOT NULL DEFAULT 'Velá Studio',
      tagline TEXT NOT NULL DEFAULT 'Piezas pensadas para vestir bonito todos los días.',
      whatsapp_number TEXT NOT NULL DEFAULT '50370000000',
      payment_link TEXT NOT NULL DEFAULT 'https://example.com/pago',
      email TEXT NOT NULL DEFAULT 'hola@velastudio.com',
      instagram TEXT NOT NULL DEFAULT '@velastudio',
      shipping_note TEXT NOT NULL DEFAULT 'Envíos en 24 a 48 horas hábiles a nivel nacional.',
      currency TEXT NOT NULL DEFAULT 'USD',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@velastudio.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

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
        process.env.BRAND_NAME || 'Velá Studio',
        'Piezas pensadas para vestir bonito todos los días.',
        '50370000000',
        'https://example.com/pago',
        'hola@velastudio.com',
        '@velastudio',
        'Envíos en 24 a 48 horas hábiles a nivel nacional.',
      ]
    );
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
        image: '/assets/products/camisa-nube.svg', tag: 'Nuevo', sizes: 'S,M,L', featured: true
      },
      {
        name: 'Camisa Lino Arena', slug: 'camisa-lino-arena', category: 'camisas', price: 27.50, compare: 32.00,
        short: 'Textura suave y acabado natural.',
        description: 'Pieza pensada para outfits limpios y elegantes. Funciona bien como prenda casual o para oficina.',
        image: '/assets/products/camisa-lino.svg', tag: 'Top venta', sizes: 'M,L,XL', featured: true
      },
      {
        name: 'Vestido Rosa Aura', slug: 'vestido-rosa-aura', category: 'vestidos', price: 39.90, compare: 45.00,
        short: 'Vestido midi con caída fluida.',
        description: 'Un diseño femenino, ligero y muy visual para destacar dentro del catálogo principal.',
        image: '/assets/products/vestido-rosa.svg', tag: 'Favorito', sizes: 'S,M,L', featured: true
      },
      {
        name: 'Vestido Noche Celeste', slug: 'vestido-noche-celeste', category: 'vestidos', price: 44.00, compare: 52.00,
        short: 'Pieza especial para una línea más premium.',
        description: 'Perfecto para elevar la selección de vestidos y comunicar una propuesta más boutique.',
        image: '/assets/products/vestido-noche.svg', tag: 'Premium', sizes: 'S,M', featured: true
      },
      {
        name: 'Pantalón Urbano', slug: 'pantalon-urbano', category: 'basicos', price: 31.99, compare: 37.00,
        short: 'Base versátil para looks sobrios.',
        description: 'Una prenda esencial para armar combinaciones con camisas, tops o blazers.',
        image: '/assets/products/pantalon-urbano.svg', tag: 'Esencial', sizes: '6,8,10,12', featured: false
      },
      {
        name: 'Set Blanco Serena', slug: 'set-blanco-serena', category: 'sets', price: 48.00, compare: 56.00,
        short: 'Conjunto de dos piezas muy vendible.',
        description: 'Propuesta lista para clientes que buscan un look completo y fácil de decidir.',
        image: '/assets/products/set-blanco.svg', tag: 'Look completo', sizes: 'S,M,L', featured: true
      },
      {
        name: 'Chaqueta Soft Rose', slug: 'chaqueta-soft-rose', category: 'basicos', price: 36.50, compare: 42.00,
        short: 'Complemento ideal para looks en capas.',
        description: 'Una chaqueta ligera con una presencia visual suave, perfecta para temporadas frescas.',
        image: '/assets/products/chaqueta-soft.svg', tag: 'Tendencia', sizes: 'M,L,XL', featured: false
      },
      {
        name: 'Falda Midi Breeze', slug: 'falda-midi-breeze', category: 'basicos', price: 29.75, compare: 34.50,
        short: 'Silueta versátil de cintura alta.',
        description: 'Funciona excelente con camisas y tops, y ayuda a ampliar el mix de productos.',
        image: '/assets/products/falda-midi.svg', tag: 'Versátil', sizes: 'S,M,L', featured: false
      }
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
