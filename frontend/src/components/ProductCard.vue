<template>
  <article class="product-card">
    <RouterLink :to="`/producto/${product.slug}`" class="product-media-wrap">
      <img :src="product.image_url" :alt="product.name" class="product-media" />
      <span class="product-tag">{{ product.tag || 'Selección' }}</span>
    </RouterLink>
    <div class="product-body">
      <div class="product-top">
        <div>
          <p class="product-eyebrow">{{ product.category_name || 'Colección' }}</p>
          <h3>{{ product.name }}</h3>
          <p>{{ product.short_description || product.category_name }}</p>
        </div>
        <div class="price-stack">
          <strong>{{ money(product.price) }}</strong>
          <span v-if="product.compare_at_price" class="compare-price">{{ money(product.compare_at_price) }}</span>
        </div>
      </div>
      <p class="product-copy">{{ product.description }}</p>
      <div class="product-actions">
        <RouterLink class="btn btn-secondary" :to="`/producto/${product.slug}`">Ver producto</RouterLink>
        <button class="btn btn-primary" type="button" @click="$emit('add', product)">Agregar</button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { RouterLink } from 'vue-router';

defineEmits(['add']);
defineProps({
  product: { type: Object, required: true },
});

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}
</script>
