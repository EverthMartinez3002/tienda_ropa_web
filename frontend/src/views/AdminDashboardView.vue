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

          <div class="image-field-group">
            <div class="image-field-header">
              <span class="field-label">Imagen del producto</span>
              <small class="muted-copy">Puede subir un archivo o pegar una URL/una ruta existente.</small>
            </div>

            <div class="image-upload-row">
              <input ref="imageInputRef" class="image-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" @change="onImageSelected" />
              <button class="btn btn-secondary" type="button" @click="uploadSelectedImage" :disabled="!selectedImageFile || imageUploadPending">
                {{ imageUploadPending ? 'Subiendo...' : 'Subir imagen' }}
              </button>
              <button class="btn btn-secondary" type="button" @click="clearSelectedImage" :disabled="imageUploadPending && !selectedImageFile">
                Limpiar selección
              </button>
            </div>

            <label><span>Ruta o URL de imagen</span><input v-model="productForm.image_url" placeholder="/uploads/mi-imagen.webp o https://..." /></label>

            <div class="image-preview-card">
              <img v-if="productPreviewImage" :src="productPreviewImage" :alt="productForm.name || 'Vista previa del producto'" class="image-preview" />
              <div v-else class="image-preview placeholder-preview">Vista previa de imagen</div>
              <div class="image-preview-meta">
                <strong>{{ selectedImageFile?.name || 'Sin archivo seleccionado' }}</strong>
                <small class="muted-copy">Tamaño máximo: 4 MB. Formatos: JPG, PNG, WEBP, GIF, SVG.</small>
                <small v-if="productForm.image_url" class="muted-copy">Ruta actual: {{ productForm.image_url }}</small>
              </div>
            </div>
          </div>

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
              <img :src="product.image_url || fallbackImage" :alt="product.name" />
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
        <p class="muted-copy">Los canales públicos del footer, el correo de contacto y el número de WhatsApp pueden definirse desde variables de entorno. Si existen, tienen prioridad sobre lo guardado en base de datos.</p>
        <div class="env-pill">WHATSAPP_NUMBER · CONTACT_EMAIL · INSTAGRAM_URL · FACEBOOK_URL</div>
        <label><span>Nombre de marca</span><input v-model="settings.brand_name" /></label>
        <label><span>Tagline</span><input v-model="settings.tagline" /></label>
        <label><span>WhatsApp</span><input v-model="settings.whatsapp_number" :disabled="settings.env_overrides.whatsapp_number" /></label>
        <small v-if="settings.env_overrides.whatsapp_number" class="field-note">Controlado por la variable de entorno WHATSAPP_NUMBER.</small>
        <label><span>Email</span><input v-model="settings.email" :disabled="settings.env_overrides.email" /></label>
        <small v-if="settings.env_overrides.email" class="field-note">Controlado por la variable de entorno CONTACT_EMAIL.</small>
        <label><span>Instagram URL</span><input v-model="settings.instagram_url" :disabled="settings.env_overrides.instagram_url" placeholder="https://www.instagram.com/su_marca" /></label>
        <small v-if="settings.env_overrides.instagram_url" class="field-note">Controlado por la variable de entorno INSTAGRAM_URL.</small>
        <label><span>Facebook URL</span><input v-model="settings.facebook_url" :disabled="settings.env_overrides.facebook_url" placeholder="https://www.facebook.com/su_marca" /></label>
        <small v-if="settings.env_overrides.facebook_url" class="field-note">Controlado por la variable de entorno FACEBOOK_URL.</small>
        <label><span>Nota de envío</span><textarea v-model="settings.shipping_note" rows="4"></textarea></label>
        <label><span>Moneda</span><input v-model="settings.currency" /></label>
        <label><span>Link de pago seguro</span><input v-model="settings.payment_link" /></label>

        <div class="theme-config-block">
          <div class="theme-section-head">
            <div>
              <h4>Colores principales</h4>
              <p class="muted-copy">Seleccione una paleta base y, si lo desea, ajuste cada color manualmente.</p>
            </div>
            <span class="theme-current-chip">{{ currentThemePresetLabel }}</span>
          </div>

          <div class="theme-preset-grid">
            <button
              v-for="preset in themePresets"
              :key="preset.key"
              type="button"
              class="theme-preset-card"
              :class="{ active: activeThemePresetKey === preset.key }"
              @click="applyThemePreset(preset)"
            >
              <div class="theme-preset-swatches">
                <span :style="{ background: preset.primary_color }"></span>
                <span :style="{ background: preset.secondary_color }"></span>
                <span :style="{ background: preset.accent_color }"></span>
              </div>
              <strong>{{ preset.label }}</strong>
              <small>{{ preset.description }}</small>
            </button>
          </div>

          <div class="theme-color-grid">
            <label class="theme-color-field">
              <span>Color primario</span>
              <div class="theme-color-input-wrap">
                <input v-model="settings.primary_color" type="color" />
                <input v-model="settings.primary_color" class="theme-hex-input" placeholder="#1F2D38" maxlength="7" />
              </div>
            </label>
            <label class="theme-color-field">
              <span>Color secundario</span>
              <div class="theme-color-input-wrap">
                <input v-model="settings.secondary_color" type="color" />
                <input v-model="settings.secondary_color" class="theme-hex-input" placeholder="#DBC8B5" maxlength="7" />
              </div>
            </label>
            <label class="theme-color-field">
              <span>Color acento</span>
              <div class="theme-color-input-wrap">
                <input v-model="settings.accent_color" type="color" />
                <input v-model="settings.accent_color" class="theme-hex-input" placeholder="#B78465" maxlength="7" />
              </div>
            </label>
          </div>

          <div class="theme-preview-card" :style="themePreviewStyle">
            <div class="theme-preview-topbar">
              <span class="theme-preview-mark">{{ previewBrandInitial }}</span>
              <div>
                <strong>{{ settings.brand_name || 'Su marca' }}</strong>
                <small>{{ settings.tagline || 'Vista previa de la identidad visual' }}</small>
              </div>
            </div>
            <div class="theme-preview-body">
              <span class="theme-preview-badge">Colección destacada</span>
              <h4>Así se sentirán los colores principales en la tienda.</h4>
              <p>La paleta elegida impactará botones, insignias, acentos visuales y elementos destacados del sitio.</p>
              <div class="theme-preview-actions">
                <span class="theme-preview-btn primary">Comprar ahora</span>
                <span class="theme-preview-btn secondary">Ver catálogo</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" type="button" @click="applyDefaultTheme">Restablecer paleta base</button>
          <button class="btn btn-primary" type="button" @click="saveSettings">Guardar configuración</button>
        </div>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useModal } from '@/composables/useModal';
import { useStorefront } from '@/composables/useStorefront';
import { applyThemeToDocument, resolveTheme, THEME_PRESETS } from '@/utils/theme';

const { request } = useApi();
const toast = useToast();
const modal = useModal();
const router = useRouter();
const store = useStorefront();
const ready = ref(false);
const admin = ref(null);
const currentSection = ref('dashboard');
const stats = reactive({ total_products: 0, total_categories: 0, featured_products: 0 });
const categories = ref([]);
const products = ref([]);
const settings = reactive({
  brand_name: '',
  tagline: '',
  whatsapp_number: '',
  email: '',
  instagram_url: '',
  facebook_url: '',
  shipping_note: '',
  currency: '',
  payment_link: '',
  primary_color: '#1F2D38',
  secondary_color: '#DBC8B5',
  accent_color: '#B78465',
  env_overrides: { whatsapp_number: false, email: false, instagram_url: false, facebook_url: false },
});
const sections = [
  { key: 'dashboard', label: 'Resumen' },
  { key: 'categories', label: 'Categorías' },
  { key: 'products', label: 'Productos' },
  { key: 'settings', label: 'Configuración' },
  { key: 'security', label: 'Seguridad' },
];
const themePresets = THEME_PRESETS;

const categoryForm = reactive({ id: '', name: '', slug: '', description: '', is_active: true });
const productForm = reactive({ id: '', name: '', slug: '', category_id: '', price: '', compare_at_price: '', tag: '', sizes: 'S,M,L', image_url: '', short_description: '', description: '', featured: false, is_active: true });
const passwordForm = reactive({ current_password: '', new_password: '' });
const imageInputRef = ref(null);
const selectedImageFile = ref(null);
const imageUploadPending = ref(false);
const previewObjectUrl = ref('');
const fallbackImage = '/assets/logo.svg';

const sectionTitle = computed(() => ({
  dashboard: 'Resumen general',
  categories: 'Gestión de categorías',
  products: 'Gestión de productos',
  settings: 'Configuración de la tienda',
  security: 'Seguridad del panel',
}[currentSection.value] || 'Panel'));

const productPreviewImage = computed(() => previewObjectUrl.value || productForm.image_url || fallbackImage);
const previewBrandInitial = computed(() => (settings.brand_name || 'Su marca').trim().charAt(0).toUpperCase() || 'S');
const resolvedPreviewTheme = computed(() => resolveTheme(settings));
const activeThemePresetKey = computed(() => {
  const current = resolvedPreviewTheme.value;
  const preset = themePresets.find((item) => item.primary_color === current.primary_color && item.secondary_color === current.secondary_color && item.accent_color === current.accent_color);
  return preset?.key || 'custom';
});
const currentThemePresetLabel = computed(() => {
  const preset = themePresets.find((item) => item.key === activeThemePresetKey.value);
  return preset ? preset.label : 'Paleta personalizada';
});
const themePreviewStyle = computed(() => ({
  '--preview-primary': resolvedPreviewTheme.value.primary_color,
  '--preview-secondary': resolvedPreviewTheme.value.secondary_color,
  '--preview-accent': resolvedPreviewTheme.value.accent_color,
  '--preview-primary-soft': resolvedPreviewTheme.value.primary_soft,
  '--preview-primary-strong': resolvedPreviewTheme.value.primary_strong,
  '--preview-accent-strong': resolvedPreviewTheme.value.accent_strong,
}));

function revokePreviewObjectUrl() {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value);
    previewObjectUrl.value = '';
  }
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function resetCategoryForm() {
  Object.assign(categoryForm, { id: '', name: '', slug: '', description: '', is_active: true });
}

function clearSelectedImage() {
  selectedImageFile.value = null;
  revokePreviewObjectUrl();
  if (imageInputRef.value) imageInputRef.value.value = '';
}

function resetProductForm() {
  Object.assign(productForm, { id: '', name: '', slug: '', category_id: '', price: '', compare_at_price: '', tag: '', sizes: 'S,M,L', image_url: '', short_description: '', description: '', featured: false, is_active: true });
  clearSelectedImage();
}

function applyThemePreset(preset) {
  settings.primary_color = preset.primary_color;
  settings.secondary_color = preset.secondary_color;
  settings.accent_color = preset.accent_color;
}

function applyDefaultTheme() {
  applyThemePreset(themePresets[0]);
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
  clearSelectedImage();
  currentSection.value = 'products';
}

function onImageSelected(event) {
  const file = event.target?.files?.[0] || null;
  revokePreviewObjectUrl();
  selectedImageFile.value = file;
  if (file) previewObjectUrl.value = URL.createObjectURL(file);
}

async function uploadSelectedImage() {
  if (!selectedImageFile.value) {
    toast.warning('Primero seleccione una imagen.');
    return;
  }

  const formData = new FormData();
  formData.append('image', selectedImageFile.value);
  imageUploadPending.value = true;

  try {
    const data = await request('/api/admin/products/upload-image', {
      method: 'POST',
      body: formData,
      successMessage: 'Imagen subida correctamente.',
    });
    productForm.image_url = data.image_url;
    clearSelectedImage();
  } finally {
    imageUploadPending.value = false;
  }
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
  if (productForm.id === id) resetProductForm();
  await Promise.all([loadProducts(), loadDashboard()]);
}

async function saveSettings() {
  const payload = { ...settings, env_overrides: undefined };
  await request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload), successMessage: 'Configuración guardada correctamente.' });
  await Promise.all([loadSettings(), store.loadStore()]);
  applyThemeToDocument(settings);
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

onBeforeUnmount(() => {
  revokePreviewObjectUrl();
});
</script>
