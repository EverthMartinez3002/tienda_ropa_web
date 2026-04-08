<template>
  <main class="container section-block product-page" v-if="product">
    <div class="product-breadcrumbs">
      <RouterLink to="/">Inicio</RouterLink>
      <span>/</span>
      <span>{{ product.category_name || 'Colección' }}</span>
      <span>/</span>
      <strong>{{ product.name }}</strong>
    </div>

    <div class="product-layout">
      <div class="product-visual-card">
        <img :src="product.image_url" :alt="product.name" class="product-detail-image" />
      </div>
      <div class="product-detail-copy">
        <p class="overline">{{ product.category_name || 'Colección' }}</p>
        <h1>{{ product.name }}</h1>
        <div class="price-line">
          <strong>{{ money(product.price) }}</strong>
          <span v-if="product.compare_at_price">{{ money(product.compare_at_price) }}</span>
        </div>
        <p class="detail-description">{{ product.description }}</p>

        <div class="detail-pill-row">
          <span class="detail-pill">Compra por WhatsApp</span>
          <span class="detail-pill">Pago por enlace</span>
          <span class="detail-pill">Atención directa</span>
        </div>

        <div class="size-wrap">
          <p class="field-label">Talla</p>
          <div class="size-grid">
            <button
              v-for="size in product.sizes"
              :key="size"
              type="button"
              class="size-chip"
              :class="{ active: selectedSize === size }"
              @click="selectedSize = size"
            >
              {{ size }}
            </button>
          </div>
        </div>

        <div class="hero-buttons product-cta">
          <button class="btn btn-primary" type="button" @click="cart.add(product, selectedSize)">Agregar a la bolsa</button>
          <RouterLink to="/" class="btn btn-secondary">Seguir comprando</RouterLink>
        </div>
      </div>
    </div>
  </main>

  <main v-else class="container section-block empty-state">
    <h3>Cargando producto...</h3>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useCart } from '@/composables/useCart';
import { useStorefront } from '@/composables/useStorefront';

const route = useRoute();
const store = useStorefront();
const cart = useCart();
const product = ref(null);
const selectedSize = ref('S');

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

onMounted(async () => {
  product.value = await store.loadProduct(route.params.slug);
  selectedSize.value = product.value?.sizes?.[0] || 'S';
  if (!store.loaded.value) await store.loadStore();
});
</script>
