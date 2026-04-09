<template>
  <main class="container section-block admin-shell" v-if="ready">
    <aside class="admin-sidebar">
      <div>
        <p class="overline">Administrador</p>
        <h2>{{ admin?.name }}</h2>
        <p class="muted-copy">{{ admin?.email }}</p>
      </div>
      <nav class="admin-nav">
        <button v-for="item in sections" :key="item.key" class="admin-nav-btn" :class="{ active: currentSection === item.key }" @click="currentSection = item.key">
          {{ item.label }}
        </button>
      </nav>
      <button class="btn btn-secondary" type="button" @click="logout">Cerrar sesión</button>
    </aside>

    <section class="admin-content">
      <header class="admin-topbar">
        <div>
          <p class="overline">Panel</p>
          <h1>{{ sectionTitle }}</h1>
        </div>
      </header>

      <div v-if="currentSection === 'dashboard'" class="dashboard-grid">
        <article class="stat-card"><span>Productos activos</span><strong>{{ stats.total_products || 0 }}</strong></article>
        <article class="stat-card"><span>Categorías activas</span><strong>{{ stats.total_categories || 0 }}</strong></article>
        <article class="stat-card"><span>Destacados</span><strong>{{ stats.featured_products || 0 }}</strong></article>
      </div>

      <div v-if="currentSection === 'categories'" class="admin-two-col">
        <form class="admin-card form-grid" @submit.prevent="saveCategory">
          <h3>{{ categoryForm.id ? 'Editar categoría' : 'Nueva categoría' }}</h3>
          <label><span>Nombre</span><input v-model="categoryForm.name" required /></label>
          <label><span>Slug</span><input v-model="categoryForm.slug" /></label>
          <label><span>Descripción</span><textarea v-model="categoryForm.description" rows="4"></textarea></label>
          <label class="checkbox-row"><input v-model="categoryForm.is_active" type="checkbox" /> <span>Activa</span></label>
          <div class="form-actions"><button class="btn btn-secondary" type="button" @click="resetCategoryForm">Limpiar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
        </form>

        <div class="admin-card list-card">
          <h3>Categorías</h3>
          <div class="admin-list">
            <article v-for="category in categories" :key="category.id" class="admin-item-card">
              <div>
                <strong>{{ category.name }}</strong>
                <p>{{ category.description || 'Sin descripción.' }}</p>
                <small>{{ category.slug }} · {{ category.is_active ? 'Activa' : 'Inactiva' }}</small>
              </div>
              <div class="admin-item-actions">
                <button class="btn btn-secondary" type="button" @click="editCategory(category)">Editar</button>
                <button class="btn btn-danger" type="button" @click="deleteCategory(category.id)">Eliminar</button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div v-if="currentSection === 'products'" class="admin-two-col">
        <form class="admin-card form-grid" @submit.prevent="saveProduct">
          <h3>{{ productForm.id ? 'Editar producto' : 'Nuevo producto' }}</h3>
          <label><span>Nombre</span><input v-model="productForm.name" required /></label>
          <label><span>Slug</span><input v-model="productForm.slug" /></label>
          <label>
            <span>Categoría</span>
            <select v-model="productForm.category_id">
              <option value="">Sin categoría</option>
              <option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option>
            </select>
          </label>
          <div class="form-split">
            <label><span>Precio</span><input v-model="productForm.price" type="number" min="0" step="0.01" required /></label>
            <label><span>Precio anterior</span><input v-model="productForm.compare_at_price" type="number" min="0" step="0.01" /></label>
          </div>
          <label><span>Tag</span><input v-model="productForm.tag" /></label>
          <label><span>Tallas</span><input v-model="productForm.sizes" placeholder="S,M,L" /></label>
          <label><span>Imagen</span><input v-model="productForm.image_url" placeholder="/assets/products/camisa-nube.svg" /></label>
          <label><span>Descripción corta</span><input v-model="productForm.short_description" /></label>
          <label><span>Descripción</span><textarea v-model="productForm.description" rows="5"></textarea></label>
          <div class="form-split checks-inline">
            <label class="checkbox-row"><input v-model="productForm.featured" type="checkbox" /> <span>Destacado</span></label>
            <label class="checkbox-row"><input v-model="productForm.is_active" type="checkbox" /> <span>Activo</span></label>
          </div>
          <div class="form-actions"><button class="btn btn-secondary" type="button" @click="resetProductForm">Limpiar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
        </form>

        <div class="admin-card list-card">
          <h3>Productos</h3>
          <div class="admin-list">
            <article v-for="product in products" :key="product.id" class="admin-item-card product-card-admin">
              <img :src="product.image_url" :alt="product.name" />
              <div>
                <strong>{{ product.name }}</strong>
                <p>{{ product.short_description || 'Sin descripción corta.' }}</p>
                <small>{{ product.category_name || 'Sin categoría' }} · {{ money(product.price) }} · {{ product.is_active ? 'Activo' : 'Oculto' }}</small>
              </div>
              <div class="admin-item-actions vertical-actions">
                <button class="btn btn-secondary" type="button" @click="editProduct(product)">Editar</button>
                <button class="btn btn-danger" type="button" @click="deleteProduct(product.id)">Eliminar</button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div v-if="currentSection === 'settings'" class="admin-card form-grid max-width-card">
        <h3>Configuración general</h3>
        <label><span>Nombre de marca</span><input v-model="settings.brand_name" /></label>
        <label><span>Tagline</span><input v-model="settings.tagline" /></label>
        <label><span>WhatsApp</span><input v-model="settings.whatsapp_number" /></label>
        <label><span>Email</span><input v-model="settings.email" /></label>
        <label><span>Instagram</span><input v-model="settings.instagram" /></label>
        <label><span>Nota de envío</span><textarea v-model="settings.shipping_note" rows="4"></textarea></label>
        <label><span>Moneda</span><input v-model="settings.currency" /></label>
        <label><span>Link de pago seguro</span><input v-model="settings.payment_link" /></label>
        <div class="form-actions"><button class="btn btn-primary" type="button" @click="saveSettings">Guardar configuración</button></div>
      </div>

      <div v-if="currentSection === 'security'" class="admin-card form-grid max-width-card">
        <h3>Cambiar contraseña</h3>
        <label><span>Contraseña actual</span><input v-model="passwordForm.current_password" type="password" /></label>
        <label><span>Nueva contraseña</span><input v-model="passwordForm.new_password" type="password" /></label>
        <div class="form-actions"><button class="btn btn-primary" type="button" @click="changePassword">Actualizar contraseña</button></div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useModal } from '@/composables/useModal';

const { request } = useApi();
const toast = useToast();
const modal = useModal();
const router = useRouter();
const ready = ref(false);
const admin = ref(null);
const currentSection = ref('dashboard');
const stats = reactive({ total_products: 0, total_categories: 0, featured_products: 0 });
const categories = ref([]);
const products = ref([]);
const settings = reactive({ brand_name: '', tagline: '', whatsapp_number: '', email: '', instagram: '', shipping_note: '', currency: '', payment_link: '' });
const sections = [
  { key: 'dashboard', label: 'Resumen' },
  { key: 'categories', label: 'Categorías' },
  { key: 'products', label: 'Productos' },
  { key: 'settings', label: 'Configuración' },
  { key: 'security', label: 'Seguridad' },
];

const categoryForm = reactive({ id: '', name: '', slug: '', description: '', is_active: true });
const productForm = reactive({ id: '', name: '', slug: '', category_id: '', price: '', compare_at_price: '', tag: '', sizes: 'S,M,L', image_url: '', short_description: '', description: '', featured: false, is_active: true });
const passwordForm = reactive({ current_password: '', new_password: '' });

const sectionTitle = computed(() => ({
  dashboard: 'Resumen general',
  categories: 'Gestión de categorías',
  products: 'Gestión de productos',
  settings: 'Configuración de la tienda',
  security: 'Seguridad del panel',
}[currentSection.value] || 'Panel'));

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function resetCategoryForm() {
  Object.assign(categoryForm, { id: '', name: '', slug: '', description: '', is_active: true });
}

function resetProductForm() {
  Object.assign(productForm, { id: '', name: '', slug: '', category_id: '', price: '', compare_at_price: '', tag: '', sizes: 'S,M,L', image_url: '', short_description: '', description: '', featured: false, is_active: true });
}

function editCategory(category) {
  Object.assign(categoryForm, { ...category });
  currentSection.value = 'categories';
}

function editProduct(product) {
  Object.assign(productForm, {
    ...product,
    category_id: product.category_id ? String(product.category_id) : '',
    sizes: Array.isArray(product.sizes) ? product.sizes.join(',') : 'S,M,L',
  });
  currentSection.value = 'products';
}

async function loadSession() {
  const data = await request('/api/admin/session', { toastError: false });
  admin.value = data.admin;
}

async function loadDashboard() {
  Object.assign(stats, await request('/api/admin/dashboard'));
}

async function loadCategories() {
  categories.value = await request('/api/admin/categories');
}

async function loadProducts() {
  products.value = await request('/api/admin/products');
}

async function loadSettings() {
  Object.assign(settings, await request('/api/admin/settings'));
}

async function saveCategory() {
  const payload = { ...categoryForm };
  if (payload.id) {
    await request(`/api/admin/categories/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload), successMessage: 'Categoría actualizada correctamente.' });
  } else {
    await request('/api/admin/categories', { method: 'POST', body: JSON.stringify(payload), successMessage: 'Categoría creada correctamente.' });
  }
  resetCategoryForm();
  await Promise.all([loadCategories(), loadDashboard()]);
}

async function deleteCategory(id) {
  const confirmed = await modal.confirm({
    title: 'Eliminar categoría',
    message: 'Esta acción eliminará la categoría seleccionada del catálogo.',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    tone: 'danger',
  });
  if (!confirmed) return;
  await request(`/api/admin/categories/${id}`, { method: 'DELETE', successMessage: 'Categoría eliminada correctamente.' });
  await Promise.all([loadCategories(), loadDashboard()]);
}

async function saveProduct() {
  const payload = { ...productForm };
  if (payload.id) {
    await request(`/api/admin/products/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload), successMessage: 'Producto actualizado correctamente.' });
  } else {
    await request('/api/admin/products', { method: 'POST', body: JSON.stringify(payload), successMessage: 'Producto creado correctamente.' });
  }
  resetProductForm();
  await Promise.all([loadProducts(), loadDashboard()]);
}

async function deleteProduct(id) {
  const confirmed = await modal.confirm({
    title: 'Eliminar producto',
    message: 'Esta acción quitará el producto del inventario disponible en la tienda.',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    tone: 'danger',
  });
  if (!confirmed) return;
  await request(`/api/admin/products/${id}`, { method: 'DELETE', successMessage: 'Producto eliminado correctamente.' });
  await Promise.all([loadProducts(), loadDashboard()]);
}

async function saveSettings() {
  await request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings), successMessage: 'Configuración guardada correctamente.' });
}

async function changePassword() {
  await request('/api/admin/change-password', { method: 'PUT', body: JSON.stringify(passwordForm), successMessage: 'Contraseña actualizada correctamente.' });
  passwordForm.current_password = '';
  passwordForm.new_password = '';
}

async function logout() {
  await request('/api/admin/logout', { method: 'POST', successMessage: 'Sesión cerrada correctamente.' });
  router.replace('/admin/login');
}

onMounted(async () => {
  try {
    await loadSession();
    await Promise.all([loadDashboard(), loadCategories(), loadProducts(), loadSettings()]);
    ready.value = true;
  } catch (_error) {
    toast.warning('Debe iniciar sesión para entrar al panel.');
    router.replace('/admin/login');
  }
});
</script>
