# Velá Studio - versión endurecida

Esta versión refuerza la seguridad básica de la demo:

- cookies de sesión `HttpOnly`, `Secure` en producción y `SameSite=Strict`
- token CSRF para operaciones del panel admin
- hashing de sesión en base de datos
- rate limit básico en login y escritura admin
- validación estricta de links de pago (`https` y allowlist opcional de dominios)
- validación de correo, WhatsApp, URLs de imagen y política mínima de contraseña
- auditoría básica de acciones administrativas
- headers de seguridad y `vercel.json`
- enlace de pago servido desde `/checkout/payment` para no exponer directamente la URL externa en la configuración pública

## Variables importantes

Revise `.env.example` y cambie como mínimo:

- `ADMIN_PASSWORD`
- `PASSWORD_PEPPER`
- `PAYMENT_ALLOWED_HOSTS`
- `DATABASE_URL`

## Admin

- URL: `/admin.html`
- El formulario ya no trae credenciales prellenadas.

## Nota de despliegue

El proyecto sigue siendo una app Node + PostgreSQL tradicional. Para Vercel, lo recomendable es usar variables de entorno del proyecto y desplegar el backend de forma compatible con Vercel Functions o dejar el backend/DB fuera de Vercel si solo quiere mostrar la demo visual.
