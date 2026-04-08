# Tienda de ropa web - Vue 3

Migración de la tienda a una base más seria con:

- Frontend en Vue 3 + Vite
- Vue Router para tienda, producto y panel admin
- Toastify para notificaciones
- Backend Node.js + Express
- PostgreSQL para productos, categorías, configuración y sesiones

## Estructura

- `frontend/` aplicación Vue 3
- `server.js` backend Express y APIs
- `db/schema.sql` esquema de PostgreSQL
- `lib/` seguridad y base de datos

## Comandos

```bash
npm install
npm run build:client
npm start
```

Para desarrollo del frontend:

```bash
npm run dev:client
```

## Rutas

- `/` tienda pública
- `/producto/:slug` detalle de producto
- `/admin/login` acceso admin
- `/admin/panel` panel admin
