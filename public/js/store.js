const CART_KEY = 'vela-studio-cart';

const state = {
  settings: null,
  categories: [],
  products: [],
  featured: [],
  currentCategory: 'all',
  search: '',
  cart: JSON.parse(localStorage.getItem(CART_KEY) || '[]'),
};

const elements = {
  brandName: document.getElementById('brandName'),
  brandTagline: document.getElementById('brandTagline'),
  shippingNote: document.getElementById('shippingNote'),
  contactEmail: document.getElementById('contactEmail'),
  contactInstagram: document.getElementById('contactInstagram'),
  contactFacebook: document.getElementById('contactFacebook'),
  featuredGrid: document.getElementById('featuredGrid'),
  productGrid: document.getElementById('productGrid'),
  categoryFilters: document.getElementById('categoryFilters'),
  searchInput: document.getElementById('searchInput'),
  productCardTemplate: document.getElementById('productCardTemplate'),
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
  contactWhatsAppBtn: document.getElementById('contactWhatsAppBtn'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  mobileSheet: document.getElementById('mobileSheet'),
};

function e(value) {
  return window.api.escapeHtml(value);
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function primarySize(product) {
  return Array.isArray(product.sizes) && product.sizes.length ? product.sizes[0] : 'S';
}

function subtotalAmount() {
  return state.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
}

function countItems() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function normalizeHandle(handle) {
  return String(handle || '').replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '');
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;
  return '#';
}

function syncHeaderState() {
  document.body.classList.toggle('nav-scrolled', window.scrollY > 24);
}

function closeMobileSheet() {
  if (elements.mobileSheet) elements.mobileSheet.hidden = true;
}

function toggleMobileSheet() {
  if (!elements.mobileSheet) return;
  elements.mobileSheet.hidden = !elements.mobileSheet.hidden;
}

function openCart() {
  elements.cartDrawer.classList.add('is-open');
  elements.cartDrawer.setAttribute('aria-hidden', 'false');
  elements.drawerOverlay.hidden = false;
  closeMobileSheet();
}

function closeCart() {
  elements.cartDrawer.classList.remove('is-open');
  elements.cartDrawer.setAttribute('aria-hidden', 'true');
  elements.drawerOverlay.hidden = true;
}

function addToCart(product, size = primarySize(product)) {
  const existing = state.cart.find((item) => item.id === product.id && item.size === size);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url,
      size,
      quantity: 1,
    });
  }
  saveCart();
  renderCart();
  openCart();
}

function updateCartLine(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
  saveCart();
  renderCart();
}

function removeCartLine(index) {
  state.cart.splice(index, 1);
  saveCart();
  renderCart();
}

function clearCart() {
  state.cart = [];
  saveCart();
  renderCart();
}

function buildWhatsAppText() {
  const lines = state.cart.map((item) => `• ${item.name} · Talla ${item.size} · x${item.quantity} · ${money(item.price * item.quantity)}`);
  return `Hola, quiero realizar este pedido:\n\n${lines.join('\n')}\n\nSubtotal: ${money(subtotalAmount())}`;
}

function openWhatsApp(number, text = '') {
  const target = text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
  window.api.openExternal(target);
}

function checkoutByWhatsApp() {
  if (!state.cart.length) {
    window.ui.toast('Primero agregue al menos un producto a la bolsa.', { variant: 'error' });
    return;
  }
  const number = (state.settings?.whatsapp_number || '').replace(/\D/g, '');
  if (!number) {
    window.ui.toast('No se ha configurado el número de WhatsApp.', { variant: 'error' });
    return;
  }
  openWhatsApp(number, buildWhatsAppText());
}

function checkoutByPaymentLink() {
  if (!state.cart.length) {
    window.ui.toast('Primero agregue al menos un producto a la bolsa.', { variant: 'error' });
    return;
  }
  if (!state.settings?.payment_enabled) {
    window.ui.toast('No se ha configurado un link de pago seguro.', { variant: 'error' });
    return;
  }
  window.api.openExternal('/checkout/payment');
}

function renderCart() {
  elements.cartCount.textContent = String(countItems());
  elements.cartSubtotal.textContent = money(subtotalAmount());

  if (!state.cart.length) {
    elements.cartItems.innerHTML = `
      <div class="empty-state">
        <h3>Su bolsa está vacía</h3>
        <p>Agregue las piezas que más le gusten antes de continuar.</p>
      </div>
    `;
    return;
  }

  elements.cartItems.innerHTML = state.cart.map((item, index) => `
    <article class="cart-line">
      <img src="${e(item.image_url)}" alt="${e(item.name)}" />
      <div class="cart-line-copy">
        <strong>${e(item.name)}</strong>
        <p>Talla ${e(item.size)}</p>
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
      if (button.dataset.action === 'increase') updateCartLine(index, 1);
      if (button.dataset.action === 'decrease') updateCartLine(index, -1);
      if (button.dataset.action === 'remove') removeCartLine(index);
    });
  });
}

function visibleProducts() {
  return state.products.filter((product) => {
    const inCategory = state.currentCategory === 'all' || product.category_slug === state.currentCategory;
    const text = `${product.name} ${product.short_description} ${product.description}`.toLowerCase();
    const inSearch = text.includes(state.search.trim().toLowerCase());
    return inCategory && inSearch;
  });
}

function renderFeatured() {
  if (!elements.featuredGrid) return;
  elements.featuredGrid.innerHTML = state.featured.slice(0, 3).map((product) => `
    <article class="feature-card">
      <img src="${e(product.image_url)}" alt="${e(product.name)}" />
      <div>
        <span class="overline">${e(product.tag || 'Destacado')}</span>
        <h3>${e(product.name)}</h3>
        <p>${e(product.short_description)}</p>
        <a class="btn btn-ghost" href="/product.html?slug=${encodeURIComponent(product.slug)}">Ver pieza</a>
      </div>
    </article>
  `).join('');
}

function renderCategoryFilters() {
  const buttons = ['<button class="chip is-active" data-category="all">Todo</button>']
    .concat(state.categories.map((category) => `<button class="chip" data-category="${e(category.slug)}">${e(category.name)}</button>`));
  elements.categoryFilters.innerHTML = buttons.join('');

  elements.categoryFilters.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentCategory = button.dataset.category;
      elements.categoryFilters.querySelectorAll('.chip').forEach((chip) => chip.classList.toggle('is-active', chip === button));
      renderProducts();
    });
  });
}

function renderProducts() {
  const products = visibleProducts();
  if (!products.length) {
    elements.productGrid.innerHTML = `
      <div class="empty-state wide-state">
        <h3>No encontramos productos</h3>
        <p>Intente otra búsqueda o cambie la categoría seleccionada.</p>
      </div>`;
    return;
  }

  elements.productGrid.innerHTML = '';
  products.forEach((product) => {
    const fragment = elements.productCardTemplate.content.cloneNode(true);
    fragment.querySelector('.product-thumb').src = product.image_url;
    fragment.querySelector('.product-thumb').alt = product.name;
    fragment.querySelector('.product-tag').textContent = product.tag || 'Disponible';
    fragment.querySelector('.product-name').textContent = product.name;
    fragment.querySelector('.product-short').textContent = product.short_description;
    fragment.querySelector('.product-price').textContent = money(product.price);
    fragment.querySelector('.product-compare').textContent = product.compare_at_price ? money(product.compare_at_price) : '';
    fragment.querySelector('.product-category').textContent = product.category_name || 'Colección';
    fragment.querySelector('.product-sizes').textContent = `Tallas ${product.sizes.join(', ')}`;

    const productHref = `/product.html?slug=${encodeURIComponent(product.slug)}`;
    fragment.querySelector('.product-thumb-link').href = productHref;
    fragment.querySelector('.product-link').href = productHref;
    fragment.querySelector('.product-detail-link').href = productHref;
    fragment.querySelector('.add-to-cart-btn').addEventListener('click', () => addToCart(product));

    elements.productGrid.appendChild(fragment);
  });
}

async function loadData() {
  const [settings, categories, products, featured] = await Promise.all([
    window.api.request('/api/public/settings'),
    window.api.request('/api/public/categories'),
    window.api.request('/api/public/products'),
    window.api.request('/api/public/products?featured=true'),
  ]);

  state.settings = settings;
  state.categories = categories;
  state.products = products;
  state.featured = featured;

  window.api.applyBrandName(settings.brand_name);

  document.title = `${settings.brand_name} | Tienda de ropa`;
  elements.brandName.textContent = settings.brand_name;
  elements.brandTagline.textContent = settings.tagline;
  elements.shippingNote.textContent = settings.shipping_note;
  const contactEmailLabel = elements.contactEmail.querySelector('[data-contact-label]') || elements.contactEmail;
  const contactInstagramLabel = elements.contactInstagram.querySelector('[data-contact-label]') || elements.contactInstagram;
  const contactFacebookLabel = elements.contactFacebook?.querySelector('[data-contact-label]') || elements.contactFacebook;

  contactEmailLabel.textContent = settings.email;
  elements.contactEmail.href = `mailto:${encodeURIComponent(settings.email)}`;
  contactInstagramLabel.textContent = 'Instagram';
  elements.contactInstagram.href = safeUrl(settings.instagram_url);
  if (elements.contactFacebook) {
    contactFacebookLabel.textContent = 'Facebook';
    elements.contactFacebook.href = safeUrl(settings.facebook_url);
  }

  renderCategoryFilters();
  renderFeatured();
  renderProducts();
  renderCart();
}

elements.searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderProducts();
});

elements.openCartButton.addEventListener('click', openCart);
elements.closeCartButton.addEventListener('click', closeCart);
elements.drawerOverlay.addEventListener('click', closeCart);
elements.clearCartButton.addEventListener('click', () => {
  if (!state.cart.length) return;
  window.ui.confirm({
    title: 'Vaciar bolsa',
    message: '¿Desea vaciar toda la bolsa?',
    confirmText: 'Vaciar',
    cancelText: 'Cancelar',
    danger: true,
  }).then((ok) => {
    if (ok) clearCart();
  });
});
elements.checkoutWhatsAppButton.addEventListener('click', checkoutByWhatsApp);
elements.checkoutPaymentButton.addEventListener('click', checkoutByPaymentLink);
elements.contactWhatsAppBtn.addEventListener('click', () => {
  const number = (state.settings?.whatsapp_number || '').replace(/\D/g, '');
  if (!number) {
    window.ui.toast('No se ha configurado el número de WhatsApp.', { variant: 'error' });
    return;
  }
  if (!state.cart.length) {
    openWhatsApp(number);
    return;
  }
  checkoutByWhatsApp();
});
syncHeaderState();
window.addEventListener('scroll', syncHeaderState, { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth > 820) closeMobileSheet();
});

elements.mobileMenuBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleMobileSheet();
});

elements.mobileSheet.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileSheet));

document.addEventListener('click', (event) => {
  if (!elements.mobileSheet || elements.mobileSheet.hidden) return;
  if (elements.mobileSheet.contains(event.target) || elements.mobileMenuBtn.contains(event.target)) return;
  closeMobileSheet();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMobileSheet();
    closeCart();
  }
});

loadData().catch((error) => {
  console.error(error);
  elements.productGrid.innerHTML = '<div class="empty-state wide-state"><h3>No se pudo cargar la tienda</h3><p>Revise la conexión con el servidor.</p></div>';
});
