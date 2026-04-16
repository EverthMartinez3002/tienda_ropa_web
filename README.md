# Tienda de ropa web · Express + Vue 3

Reconstrucción limpia del proyecto para trabajar únicamente con:

- **Backend:** Express + PostgreSQL
- **Frontend:** Vue 3 + Vite
- **Autenticación admin:** cookie de sesión + CSRF
- **Canales de venta:** WhatsApp y enlace de pago seguro

## Qué incluye

- Tienda pública con portada, destacados, catálogo, detalle de producto y carrito local
- Panel admin para:
  - categorías
  - productos
  - configuración general
  - cambio de contraseña
- Endurecimiento básico:
  - rate limiting
  - cookies seguras
  - CSRF
  - auditoría admin
  - validación de URLs y correo
- Seed inicial de marca, categorías y productos demo

## Estructura

- `server.js`: compone la app Express
- `index.js`: arranque local
- `api/index.js`: entrypoint para Vercel
- `src/`: backend modular
- `frontend/`: SPA Vue 3
- `dist/client/`: build generado por Vite
- `db/schema.sql`: referencia del esquema

## Desarrollo local

1. Copie `.env.example` a `.env`
2. Ajuste `DATABASE_URL`
3. Instale dependencias
4. Ejecute:

```bash
npm install
npm run dev
```

Frontend Vite opcional en modo separado:

```bash
npm run dev:client
```

## Build

```bash
npm run build
npm start
```

## Vercel

Configuración recomendada:

- **Framework Preset:** `Other`
- **Build Command:** `npm run build`
- **Output Directory:** vacío
- **Root Directory:** `./`

La app usa `api/index.js` como función Node y el build del frontend se empaqueta desde `dist/client/**`.

## Variables importantes

- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PASSWORD_PEPPER`
- `WHATSAPP_NUMBER`
- `CONTACT_EMAIL`
- `INSTAGRAM_URL`
- `FACEBOOK_URL`
- `PAYMENT_ALLOWED_HOSTS`
- `DEFAULT_PAYMENT_LINK`

## Nota sobre PostgreSQL y SSL

Si su proveedor le exige SSL, ajuste `DATABASE_URL` con un modo explícito. Para mantener el comportamiento fuerte actual, use `sslmode=verify-full` si su proveedor lo soporta.

## Rutas principales

### Públicas
- `GET /api/public/settings`
- `GET /api/public/categories`
- `GET /api/public/products`
- `GET /api/public/products/:slug`
- `GET /checkout/payment`

### Admin
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/dashboard`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `PUT /api/admin/change-password`
