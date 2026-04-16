# Tienda de ropa web - Express + Vue 3

Base unificada del proyecto:

- **Backend:** Node.js + Express
- **Frontend:** Vue 3 + Vue Router + Vite
- **Base de datos:** PostgreSQL
- **Admin:** autenticación por sesión + CSRF

## Estado de la arquitectura

La base legacy fue retirada. El proyecto ahora funciona con una sola aplicación canónica:

- `server.js` expone las APIs y sirve la SPA Vue 3
- `frontend/` contiene la aplicación Vue 3
- `frontend/public/assets/` contiene los assets públicos usados por la tienda
- `lib/` contiene seguridad y bootstrap de base de datos
- `db/schema.sql` contiene el esquema base

## Desarrollo

```bash
npm install
npm run dev
```

En desarrollo, Express monta Vite en middleware mode para servir la SPA y las APIs desde un solo entrypoint.

## Build de producción

```bash
npm install
npm run build
npm start
```

En producción, Express sirve `frontend/dist`.

## Rutas canónicas

- `/` tienda pública
- `/producto/:slug` detalle de producto
- `/admin/login` acceso admin
- `/admin/panel` panel admin

Se mantienen redirecciones de compatibilidad para rutas viejas como `/index.html`, `/product.html?slug=...` y `/admin.html`.

## Variables de entorno públicas

```env
WHATSAPP_NUMBER=50370000000
CONTACT_EMAIL=hola@su-tienda.com
INSTAGRAM_URL=https://www.instagram.com/su_tienda
FACEBOOK_URL=https://www.facebook.com/su_tienda
```

Si estas variables están presentes, tienen prioridad sobre lo guardado en la base de datos.
