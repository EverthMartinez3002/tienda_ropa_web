const sections = ['dashboard', 'categories', 'products', 'settings', 'security'];

const state = {
  admin: null,
  categories: [],
  products: [],
  settings: null,
};

function field(form, name) {
  return form.elements.namedItem(name);
}

const el = {
  loginScreen: document.getElementById('loginScreen'),
  adminApp: document.getElementById('adminApp'),
  loginForm: document.getElementById('loginForm'),
  loginMessage: document.getElementById('loginMessage'),
  adminUserChip: document.getElementById('adminUserChip'),
  adminHeading: document.getElementById('adminHeading'),
  navButtons: [...document.querySelectorAll('.admin-nav-btn')],
  logoutButton: document.getElementById('logoutButton'),
  dashboardStats: document.getElementById('dashboardStats'),
  categoryForm: document.getElementById('categoryForm'),
  resetCategoryForm: document.getElementById('resetCategoryForm'),
  categoryMessage: document.getElementById('categoryMessage'),
  categoriesList: document.getElementById('categoriesList'),
  productForm: document.getElementById('productForm'),
  resetProductForm: document.getElementById('resetProductForm'),
  productMessage: document.getElementById('productMessage'),
  productsList: document.getElementById('productsList'),
  productCategorySelect: document.getElementById('productCategorySelect'),
  settingsForm: document.getElementById('settingsForm'),
  settingsMessage: document.getElementById('settingsMessage'),
  passwordForm: document.getElementById('passwordForm'),
  passwordMessage: document.getElementById('passwordMessage'),
};

function showMessage(node, message, ok = false) {
  node.textContent = message;
  node.classList.toggle('is-success', ok);
}

function formToObject(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function setSection(section) {
  sections.forEach((name) => {
    document.getElementById(`section-${name}`).classList.toggle('is-visible', name === section);
  });
  el.navButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.section === section));
  const titles = {
    dashboard: 'Resumen general',
    categories: 'Gestión de categorías',
    products: 'Gestión de productos',
    settings: 'Configuración de la tienda',
    security: 'Seguridad del panel',
  };
  el.adminHeading.textContent = titles[section] || 'Panel';
}

function mountCategoryOptions() {
  el.productCategorySelect.innerHTML = '<option value="">Sin categoría</option>' + state.categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('');
}

function renderDashboard(stats) {
  el.dashboardStats.innerHTML = `
    <article class="stat-card"><span>Productos activos</span><strong>${stats.total_products}</strong></article>
    <article class="stat-card"><span>Categorías activas</span><strong>${stats.total_categories}</strong></article>
    <article class="stat-card"><span>Destacados</span><strong>${stats.featured_products}</strong></article>
  `;
}

function renderCategories() {
  if (!state.categories.length) {
    el.categoriesList.innerHTML = '<div class="empty-state"><p>No hay categorías registradas.</p></div>';
    return;
  }
  el.categoriesList.innerHTML = state.categories.map((category) => `
    <article class="admin-item-card">
      <div>
        <strong>${category.name}</strong>
        <p>${category.description || 'Sin descripción.'}</p>
        <small>${category.slug} · ${category.is_active ? 'Activa' : 'Inactiva'}</small>
      </div>
      <div class="admin-item-actions">
        <button class="btn btn-ghost" data-edit-category="${category.id}">Editar</button>
        <button class="btn btn-danger" data-delete-category="${category.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  el.categoriesList.querySelectorAll('[data-edit-category]').forEach((button) => {
    button.addEventListener('click', () => fillCategoryForm(Number(button.dataset.editCategory)));
  });
  el.categoriesList.querySelectorAll('[data-delete-category]').forEach((button) => {
    button.addEventListener('click', () => removeCategory(Number(button.dataset.deleteCategory)));
  });
}

function renderProducts() {
  if (!state.products.length) {
    el.productsList.innerHTML = '<div class="empty-state"><p>No hay productos registrados.</p></div>';
    return;
  }
  el.productsList.innerHTML = state.products.map((product) => `
    <article class="admin-item-card product-card-admin">
      <img src="${product.image_url}" alt="${product.name}" />
      <div>
        <strong>${product.name}</strong>
        <p>${product.short_description || 'Sin descripción corta.'}</p>
        <small>${product.category_name || 'Sin categoría'} · $${Number(product.price).toFixed(2)} · ${product.is_active ? 'Activo' : 'Oculto'}</small>
      </div>
      <div class="admin-item-actions vertical-actions">
        <button class="btn btn-ghost" data-edit-product="${product.id}">Editar</button>
        <button class="btn btn-danger" data-delete-product="${product.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  el.productsList.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => fillProductForm(Number(button.dataset.editProduct)));
  });
  el.productsList.querySelectorAll('[data-delete-product]').forEach((button) => {
    button.addEventListener('click', () => removeProduct(Number(button.dataset.deleteProduct)));
  });
}

function fillCategoryForm(id) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;
  field(el.categoryForm, 'id').value = category.id;
  field(el.categoryForm, 'name').value = category.name;
  field(el.categoryForm, 'slug').value = category.slug;
  field(el.categoryForm, 'description').value = category.description || '';
  field(el.categoryForm, 'is_active').checked = category.is_active;
}

function resetCategoryForm() {
  el.categoryForm.reset();
  field(el.categoryForm, 'id').value = '';
  field(el.categoryForm, 'is_active').checked = true;
  showMessage(el.categoryMessage, '');
}

async function removeCategory(id) {
  if (!confirm('¿Desea eliminar esta categoría?')) return;
  await window.api.request(`/api/admin/categories/${id}`, { method: 'DELETE' });
  await loadCategories();
}

function fillProductForm(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  field(el.productForm, 'id').value = product.id;
  field(el.productForm, 'name').value = product.name;
  field(el.productForm, 'slug').value = product.slug;
  field(el.productForm, 'category_id').value = product.category_id || '';
  field(el.productForm, 'price').value = product.price;
  field(el.productForm, 'compare_at_price').value = product.compare_at_price || '';
  field(el.productForm, 'tag').value = product.tag || '';
  field(el.productForm, 'sizes').value = product.sizes.join(',');
  field(el.productForm, 'image_url').value = product.image_url || '';
  field(el.productForm, 'short_description').value = product.short_description || '';
  field(el.productForm, 'description').value = product.description || '';
  field(el.productForm, 'featured').checked = product.featured;
  field(el.productForm, 'is_active').checked = product.is_active;
}

function resetProductForm() {
  el.productForm.reset();
  field(el.productForm, 'id').value = '';
  field(el.productForm, 'is_active').checked = true;
  showMessage(el.productMessage, '');
}

async function removeProduct(id) {
  if (!confirm('¿Desea eliminar este producto?')) return;
  await window.api.request(`/api/admin/products/${id}`, { method: 'DELETE' });
  await loadProducts();
  await loadDashboard();
}

async function loadCategories() {
  state.categories = await window.api.request('/api/admin/categories');
  renderCategories();
  mountCategoryOptions();
}

async function loadProducts() {
  state.products = await window.api.request('/api/admin/products');
  renderProducts();
}

async function loadSettings() {
  state.settings = await window.api.request('/api/admin/settings');
  Object.entries(state.settings).forEach(([key, value]) => {
    const input = field(el.settingsForm, key);
    if (input) input.value = value ?? '';
  });
}

async function loadDashboard() {
  const stats = await window.api.request('/api/admin/dashboard');
  renderDashboard(stats);
}

async function bootAdmin() {
  const session = await window.api.request('/api/admin/session');
  state.admin = session.admin;
  el.adminUserChip.textContent = `${state.admin.name} · ${state.admin.email}`;
  el.loginScreen.hidden = true;
  el.adminApp.hidden = false;
  await Promise.all([loadDashboard(), loadCategories(), loadProducts(), loadSettings()]);
}

el.navButtons.forEach((button) => {
  button.addEventListener('click', () => setSection(button.dataset.section));
});

el.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(el.loginMessage, '');
  try {
    const data = formToObject(el.loginForm);
    await window.api.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await bootAdmin();
  } catch (error) {
    showMessage(el.loginMessage, error.message);
  }
});

el.logoutButton.addEventListener('click', async () => {
  await window.api.request('/api/admin/logout', { method: 'POST' });
  window.location.reload();
});

el.categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = formToObject(el.categoryForm);
    data.is_active = field(el.categoryForm, 'is_active').checked;
    if (data.id) {
      await window.api.request(`/api/admin/categories/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      showMessage(el.categoryMessage, 'Categoría actualizada correctamente.', true);
    } else {
      await window.api.request('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) });
      showMessage(el.categoryMessage, 'Categoría creada correctamente.', true);
    }
    resetCategoryForm();
    await loadCategories();
    await loadDashboard();
  } catch (error) {
    showMessage(el.categoryMessage, error.message);
  }
});

el.resetCategoryForm.addEventListener('click', resetCategoryForm);

el.productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = formToObject(el.productForm);
    data.featured = field(el.productForm, 'featured').checked;
    data.is_active = field(el.productForm, 'is_active').checked;
    if (data.id) {
      await window.api.request(`/api/admin/products/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      showMessage(el.productMessage, 'Producto actualizado correctamente.', true);
    } else {
      await window.api.request('/api/admin/products', { method: 'POST', body: JSON.stringify(data) });
      showMessage(el.productMessage, 'Producto creado correctamente.', true);
    }
    resetProductForm();
    await loadProducts();
    await loadDashboard();
  } catch (error) {
    showMessage(el.productMessage, error.message);
  }
});

el.resetProductForm.addEventListener('click', resetProductForm);

el.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = formToObject(el.settingsForm);
    await window.api.request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
    showMessage(el.settingsMessage, 'Configuración guardada correctamente.', true);
  } catch (error) {
    showMessage(el.settingsMessage, error.message);
  }
});

el.passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = formToObject(el.passwordForm);
    await window.api.request('/api/admin/change-password', { method: 'PUT', body: JSON.stringify(data) });
    el.passwordForm.reset();
    showMessage(el.passwordMessage, 'Contraseña actualizada correctamente.', true);
  } catch (error) {
    showMessage(el.passwordMessage, error.message);
  }
});

bootAdmin().catch(() => {
  el.loginScreen.hidden = false;
  el.adminApp.hidden = true;
});
