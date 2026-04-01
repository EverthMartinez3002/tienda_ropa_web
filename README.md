# Trenda - Tienda de ropa web

Proyecto base de una tienda de ropa creado desde cero con HTML, CSS y JavaScript puro.

## Incluye

- Landing page moderna y responsiva
- Catálogo de productos
- Filtro por categorías
- Búsqueda por nombre
- Carrito lateral funcional
- Persistencia del carrito con `localStorage`
- Diseño listo para personalizar con su marca

## Estructura

```text
.
├── assets/
│   ├── logo.svg
│   └── products/
│       ├── camisa-lino.svg
│       ├── camisa-nube.svg
│       ├── chaqueta-soft.svg
│       ├── falda-midi.svg
│       ├── pantalon-urbano.svg
│       ├── set-blanco.svg
│       ├── vestido-noche.svg
│       └── vestido-rosa.svg
├── index.html
├── script.js
└── styles.css
```

## Cómo usarlo

Solo abra `index.html` en el navegador.

Si quiere correrlo con un servidor local:

```bash
python -m http.server 5500
```

Después abra `http://localhost:5500`.

## Personalizaciones recomendadas

- Cambiar el nombre de la marca y el logo
- Reemplazar los productos de ejemplo por su inventario real
- Conectar el botón de finalizar pedido a WhatsApp o a una pasarela de pago
- Agregar backend para usuarios, pedidos e inventario
