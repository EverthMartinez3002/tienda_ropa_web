# Velá Studio - Tienda de ropa seria

Base seria de una tienda de ropa con:

- Tienda pública
- Página de producto
- Carrito persistente
- Opción de vaciar la bolsa antes de finalizar
- Checkout por WhatsApp
- Checkout por link de pago
- Panel admin
- Login de administrador
- CRUD de categorías
- CRUD de productos
- Configuración general de la tienda
- Backend con Node.js + Express
- PostgreSQL

## Acceso al admin

- URL: `http://localhost:3000/admin.html`
- correo: `admin@velastudio.local`
- clave: `admin123`

## Ejecutar con Docker

```bash
cp .env.example .env
docker compose up --build
```

Luego abra:

- `http://localhost:3000`
- `http://localhost:3000/admin.html`

## Ejecutar sin Docker

1. Cree una base PostgreSQL.
2. Configure `DATABASE_URL`.
3. Instale dependencias:

```bash
npm install
npm start
```

## Nota

La tienda pública no requiere cuenta de cliente. El cierre de compra está pensado para WhatsApp y link de pago, como usted pidió.
