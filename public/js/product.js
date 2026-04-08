const CART_KEY = 'vela-studio-cart';
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

const state = {
  settings: null,
  product: null,
  selectedSize: null,
  cart: JSON.parse(localStorage.getItem(CART_KEY) || '[]'),
};

const elements = {
  productImage: document.getElementById('productImage'),
  productCategory: document.getElementById('productCategory'),
  productName: document.getElementById('productName'),
  productPrice: document.getElementById('productPrice'),
  productCompare: document.getElementById('productCompare'),
  productShort: document.getElementById('productShort'),
  productDescription: document.getElementById('productDescription'),
  sizeOptions: document.getElementById('sizeOptions'),
  shippingNoteProduct: document.getElementById('shippingNoteProduct'),
  addProductToCart: document.getElementById('addProductToCart'),
  buyByWhatsApp: document.getElementById('buyByWhatsApp'),
  cartCount: document.getElementById('cartCount'),
  cartItems: document.getElementById('cartItems'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartDrawer: document.getElementById('cartDrawer'),
  drawerOverlay: document.getElementById('drawerOverlay'),
  openCartButton: document.getElementById('openCartButton'),
  closeCartButton: document.getElementById('closeCartButton'),
  clearCartButton: document.getElementById('clearCartButton'),
  checkoutWhatsAppButton: document.getElementById('checkoutWhatsAppButton'),
  checkoutPaymentButton: document.getElementById('checkoutPaymentButton'),
};

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function cartSubtotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
}

function countItems() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function openCart() {
  elements.cartDrawer.classList.add('is-open');
  elements.cartDrawer.setAttribute('aria-hidden', 'false');
  elements.drawerOverlay.hidden = false;
}

function closeCart() {
  elements.cartDrawer.classList.remove('is-open');
  elements.cartDrawer.setAttribute('aria-hidden', 'true');
  elements.drawerOverlay.hidden = true;
}

function renderCart() {
  elements.cartCount.textContent = String(countItems());
  elements.cartSubtotal.textContent = money(cartSubtotal());
  if (!state.cart.length) {
    elements.cartItems.innerHTML = '<div class="empty-state"><h3>Su bolsa está vacía</h3><p>Agregue una pieza para continuar.</p></div>';
    return;
  }
  elements.cartItems.innerHTML = state.cart.map((item, index) => `
    <article class="cart-line">
      <img src="${item.image_url}" alt="${item.name}" />
      <div class="cart-line-copy">
        <strong>${item.name}</strong>
        <p>Talla ${item.size}</p>
        <p>${money(item.price)}</p>
        <div class="cart-line-actions">
          <button data-action="decrease" data-index="${index}">−</button>
          <span>${item.quantity}</span>
          <button data-action="increase" data-index="${index}">+</button>
          <button class="remove-text" data-action="remove" data-index="${index}">Quitar</button>
        </div>
      </div>
    </article>
  `).join('');
  elements.cartItems.querySelectorAll('button[data-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      if (button.dataset.action === 'increase') state.cart[index].quantity += 1;
      if (button.dataset.action === 'decrease') state.cart[index].quantity -= 1;
      if (button.dataset.action === 'remove' || state.cart[index].quantity <= 0) state.cart.splice(index, 1);
      saveCart();
      renderCart();
    });
  });
}

function addCurrentProductToCart() {
  if (!state.product) return;
  const size = state.selectedSize || state.product.sizes[0] || 'S';
  const existing = state.cart.find((item) => item.id === state.product.id && item.size === size);
  if (existing) existing.quantity += 1;
  else {
    state.cart.push({
      id: state.product.id,
      slug: state.product.slug,
      name: state.product.name,
      price: Number(state.product.price),
      image_url: state.product.image_url,
      size,
      quantity: 1,
    });
  }
  saveCart();
  renderCart();
  openCart();
}

function renderSizes() {
  elements.sizeOptions.innerHTML = state.product.sizes.map((size, index) => `
    <button class="size-chip ${index === 0 ? 'is-active' : ''}" data-size="${size}">${size}</button>
  `).join('');
  state.selectedSize = state.product.sizes[0] || 'S';
  elements.sizeOptions.querySelectorAll('[data-size]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSize = button.dataset.size;
      elements.sizeOptions.querySelectorAll('.size-chip').forEach((chip) => chip.classList.toggle('is-active', chip === button));
    });
  });
}

function checkoutByWhatsAppSingle() {
  if (!state.product) return;
  const size = state.selectedSize || state.product.sizes[0] || 'S';
  const number = (state.settings?.whatsapp_number || '').replace(/\D/g, '');
  if (!number) return alert('No se ha configurado el número de WhatsApp.');
  const text = encodeURIComponent(`Hola, quiero comprar este producto:

${state.product.name}
Talla: ${size}
Precio: ${money(state.product.price)}`);
  window.open(`https://wa.me/${number}?text=${text}`, '_blank');
}

function buildWhatsAppCartText() {
  const lines = state.cart.map((item) => `• ${item.name} · Talla ${item.size} · x${item.quantity} · ${money(item.price * item.quantity)}`);
  return `https://wa.me/${(state.settings?.whatsapp_number || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero realizar este pedido:\n\n${lines.join('\n')}\n\nSubtotal: ${money(cartSubtotal())}`)}`;
}

async function loadProduct() {
  if (!slug) {
    document.getElementById('productPage').innerHTML = '<div class="empty-state wide-state"><h3>Producto no encontrado</h3></div>';
    return;
  }
  const [settings, product] = await Promise.all([
    window.api.request('/api/public/settings'),
    window.api.request(`/api/public/products/${encodeURIComponent(slug)}`),
  ]);
  state.settings = settings;
  state.product = product;

  document.title = `${product.name} | ${settings.brand_name}`;
  elements.productImage.src = product.image_url;
  elements.productImage.alt = product.name;
  elements.productCategory.textContent = product.category_name || 'Colección';
  elements.productName.textContent = product.name;
  elements.productPrice.textContent = money(product.price);
  elements.productCompare.textContent = product.compare_at_price ? money(product.compare_at_price) : '';
  elements.productShort.textContent = product.short_description;
  elements.productDescription.textContent = product.description;
  elements.shippingNoteProduct.textContent = settings.shipping_note;
  renderSizes();
  renderCart();
}

elements.openCartButton.addEventListener('click', openCart);
elements.closeCartButton.addEventListener('click', closeCart);
elements.drawerOverlay.addEventListener('click', closeCart);
elements.clearCartButton.addEventListener('click', () => {
  if (!state.cart.length) return;
  if (confirm('¿Desea vaciar toda la bolsa?')) {
    state.cart = [];
    saveCart();
    renderCart();
  }
});
elements.addProductToCart.addEventListener('click', addCurrentProductToCart);
elements.buyByWhatsApp.addEventListener('click', checkoutByWhatsAppSingle);
elements.checkoutWhatsAppButton.addEventListener('click', () => {
  if (!state.cart.length) return alert('Primero agregue un producto a la bolsa.');
  window.open(buildWhatsAppCartText(), '_blank');
});
elements.checkoutPaymentButton.addEventListener('click', () => {
  if (!state.cart.length) return alert('Primero agregue un producto a la bolsa.');
  if (!state.settings?.payment_link) return alert('No se ha configurado el link de pago.');
  window.open(state.settings.payment_link, '_blank');
});

loadProduct().catch((error) => {
  console.error(error);
  document.getElementById('productPage').innerHTML = '<div class="empty-state wide-state"><h3>No se pudo cargar el producto</h3></div>';
});
