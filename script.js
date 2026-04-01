const products = [
  {
    id: 1,
    name: "Camisa Nube",
    category: "camisas",
    price: 24.99,
    tag: "Nuevo",
    image: "assets/products/camisa-nube.svg",
    meta: "Camisa ligera · Tallas S a L",
    description: "Corte relajado con acabado fresco para looks casuales y elegantes.",
  },
  {
    id: 2,
    name: "Camisa Lino Arena",
    category: "camisas",
    price: 27.5,
    tag: "Top venta",
    image: "assets/products/camisa-lino.svg",
    meta: "Lino suave · Tallas M a XL",
    description: "Perfecta para una colección cápsula con estilo limpio y moderno.",
  },
  {
    id: 3,
    name: "Vestido Rosa Aura",
    category: "vestidos",
    price: 39.9,
    tag: "Favorito",
    image: "assets/products/vestido-rosa.svg",
    meta: "Midi fluido · Tallas S a L",
    description: "Prenda con caída suave y una silueta pensada para destacar.",
  },
  {
    id: 4,
    name: "Vestido Noche Celeste",
    category: "vestidos",
    price: 44.0,
    tag: "Premium",
    image: "assets/products/vestido-noche.svg",
    meta: "Evento · Tallas S a M",
    description: "Una pieza visual para elevar la sección más exclusiva del catálogo.",
  },
  {
    id: 5,
    name: "Pantalón Urbano",
    category: "basicos",
    price: 31.99,
    tag: "Esencial",
    image: "assets/products/pantalon-urbano.svg",
    meta: "Corte recto · Tallas 6 a 12",
    description: "Base versátil para armar outfits sobrios con personalidad.",
  },
  {
    id: 6,
    name: "Set Blanco Serena",
    category: "sets",
    price: 48.0,
    tag: "Look completo",
    image: "assets/products/set-blanco.svg",
    meta: "Set 2 piezas · Tallas S a L",
    description: "Conjunto moderno ideal para una vitrina limpia, femenina y premium.",
  },
  {
    id: 7,
    name: "Chaqueta Soft Rose",
    category: "basicos",
    price: 36.5,
    tag: "Tendencia",
    image: "assets/products/chaqueta-soft.svg",
    meta: "Liviana · Tallas M a XL",
    description: "Complemento estilizado para temporadas frescas o looks en capas.",
  },
  {
    id: 8,
    name: "Falda Midi Breeze",
    category: "basicos",
    price: 29.75,
    tag: "Versátil",
    image: "assets/products/falda-midi.svg",
    meta: "Cintura alta · Tallas S a L",
    description: "Una falda adaptable para combinar con camisas, tops y blazers.",
  },
];

const state = {
  category: "all",
  search: "",
  cart: JSON.parse(localStorage.getItem("trenda-cart") || "[]"),
};

const productGrid = document.getElementById("productGrid");
const productTemplate = document.getElementById("productTemplate");
const categoryFilters = document.getElementById("categoryFilters");
const searchInput = document.getElementById("searchInput");
const cartCount = document.getElementById("cartCount");
const cartItems = document.getElementById("cartItems");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartDrawer = document.getElementById("cartDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const openCartButton = document.getElementById("openCartButton");
const closeCartButton = document.getElementById("closeCartButton");
const checkoutButton = document.getElementById("checkoutButton");
const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");

function saveCart() {
  localStorage.setItem("trenda-cart", JSON.stringify(state.cart));
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function filteredProducts() {
  return products.filter((product) => {
    const byCategory = state.category === "all" || product.category === state.category;
    const searchable = `${product.name} ${product.category} ${product.meta}`.toLowerCase();
    const bySearch = searchable.includes(state.search.toLowerCase().trim());
    return byCategory && bySearch;
  });
}

function renderProducts() {
  productGrid.innerHTML = "";
  const visibleProducts = filteredProducts();

  if (!visibleProducts.length) {
    productGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No encontramos productos</h3>
        <p>Pruebe con otra búsqueda o cambie la categoría seleccionada.</p>
      </div>
    `;
    return;
  }

  visibleProducts.forEach((product) => {
    const fragment = productTemplate.content.cloneNode(true);
    fragment.querySelector(".product-media").src = product.image;
    fragment.querySelector(".product-media").alt = product.name;
    fragment.querySelector(".product-tag").textContent = product.tag;
    fragment.querySelector(".product-name").textContent = product.name;
    fragment.querySelector(".product-meta").textContent = product.meta;
    fragment.querySelector(".product-price").textContent = money(product.price);
    fragment.querySelector(".product-description").textContent = product.description;

    fragment.querySelector(".add-to-cart-btn").addEventListener("click", () => {
      addToCart(product.id);
    });

    productGrid.appendChild(fragment);
  });
}

function addToCart(productId) {
  const existing = state.cart.find((item) => item.id === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ id: productId, quantity: 1 });
  }

  saveCart();
  renderCart();
  openCart();
}

function updateQuantity(productId, amount) {
  const item = state.cart.find((entry) => entry.id === productId);
  if (!item) return;

  item.quantity += amount;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.id !== productId);
  }

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((entry) => entry.id !== productId);
  saveCart();
  renderCart();
}

function cartDetailedItems() {
  return state.cart.map((entry) => {
    const product = products.find((item) => item.id === entry.id);
    return {
      ...product,
      quantity: entry.quantity,
      total: product.price * entry.quantity,
    };
  });
}

function renderCart() {
  const detailedItems = cartDetailedItems();
  const totalItems = detailedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.total, 0);

  cartCount.textContent = totalItems;
  cartSubtotal.textContent = money(subtotal);

  if (!detailedItems.length) {
    cartItems.innerHTML = `
      <div class="empty-state">
        <h3>Su carrito está vacío</h3>
        <p>Agregue prendas del catálogo para comenzar un pedido.</p>
      </div>
    `;
    return;
  }

  cartItems.innerHTML = detailedItems
    .map(
      (item) => `
        <article class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div class="cart-item-content">
            <strong>${item.name}</strong>
            <p>${item.meta}</p>
            <p>${money(item.price)} c/u</p>
            <div class="cart-item-actions">
              <button class="qty-btn" data-action="decrease" data-id="${item.id}">−</button>
              <strong>${item.quantity}</strong>
              <button class="qty-btn" data-action="increase" data-id="${item.id}">+</button>
              <button class="remove-btn" data-action="remove" data-id="${item.id}">Quitar</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  cartItems.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.action;

      if (action === "increase") updateQuantity(id, 1);
      if (action === "decrease") updateQuantity(id, -1);
      if (action === "remove") removeFromCart(id);
    });
  });
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  drawerOverlay.hidden = false;
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  drawerOverlay.hidden = true;
}

function toggleMobileMenu() {
  mobileMenu.hidden = !mobileMenu.hidden;
}

categoryFilters.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-category]");
  if (!target) return;

  state.category = target.dataset.category;
  categoryFilters
    .querySelectorAll(".filter-btn")
    .forEach((button) => button.classList.toggle("is-active", button === target));

  renderProducts();
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderProducts();
});

openCartButton.addEventListener("click", openCart);
closeCartButton.addEventListener("click", closeCart);
drawerOverlay.addEventListener("click", closeCart);
menuButton.addEventListener("click", toggleMobileMenu);

mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileMenu.hidden = true;
  });
});

checkoutButton.addEventListener("click", () => {
  const detailedItems = cartDetailedItems();

  if (!detailedItems.length) {
    alert("Primero agregue al menos un producto al carrito.");
    return;
  }

  const summary = detailedItems
    .map((item) => `${item.name} x${item.quantity} - ${money(item.total)}`)
    .join("\n");

  alert(`Pedido listo para continuar:\n\n${summary}\n\nSubtotal: ${money(detailedItems.reduce((sum, item) => sum + item.total, 0))}`);
});

renderProducts();
renderCart();
