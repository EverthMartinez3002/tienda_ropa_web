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


## Imágenes de productos

- El panel permite pegar una URL HTTPS o subir una imagen PNG, JPG o WEBP.
- Las imágenes subidas se guardan dentro del propio producto para que la demo siga funcionando también en despliegues efímeros.
- El tamaño máximo se controla con `MAX_PRODUCT_IMAGE_BYTES` (por defecto 2097152, equivalente a 2 MB).

## Variables de entorno para canales públicos

Defina estos valores para publicar los enlaces del footer y el número de contacto sin dejarlos quemados en la app:

```env
WHATSAPP_NUMBER=50370000000
CONTACT_EMAIL=hola@su-tienda.com
INSTAGRAM_URL=https://www.instagram.com/su_tienda
FACEBOOK_URL=https://www.facebook.com/su_tienda
```

Si estas variables están presentes, tienen prioridad sobre lo guardado en la base de datos. CONTACT_EMAIL controla el correo público mostrado en el footer y enlaces de contacto.
