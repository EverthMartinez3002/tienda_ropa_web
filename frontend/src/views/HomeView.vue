<template>
  <main>
    <section class="hero-section container" id="nuevo">
      <div class="hero-copy">
        <p class="overline">Nueva colección</p>
        <h1>{{ brandName }}</h1>
        <p class="hero-text">
          {{ store.settings.value?.tagline || 'Moda femenina con una experiencia boutique, limpia y pensada para vender por WhatsApp o link de pago.' }}
        </p>
        <div class="hero-buttons">
          <button class="btn btn-primary" type="button" @click="scrollToCatalog">Ver catálogo</button>
          <button class="btn btn-secondary" type="button" @click="scrollToBrand">Conocer la marca</button>
        </div>
        <div class="hero-mini-stats">
          <article>
            <strong>{{ store.products.value.length || 0 }}</strong>
            <span>Piezas activas</span>
          </article>
          <article>
            <strong>Directo</strong>
            <span>WhatsApp o pago</span>
          </article>
          <article>
            <strong>Premium</strong>
            <span>Estética editorial</span>
          </article>
        </div>
      </div>

      <div class="hero-art">
        <div class="hero-shape hero-shape-left"></div>
        <div class="hero-shape hero-shape-right"></div>
        <div class="hero-floating-card hero-floating-card-left">
          <span class="floating-title">Selección curada</span>
          <strong>Piezas con mejor salida</strong>
        </div>
        <div class="hero-floating-card hero-floating-card-right">
          <span class="floating-title">Compra simple</span>
          <strong>Sin registro obligatorio</strong>
        </div>
      </div>
    </section>

    <section class="container feature-strip">
      <article>
        <strong>Estilo boutique</strong>
        <p>Composición limpia, tipografía editorial y catálogo más pulido.</p>
      </article>
      <article>
        <strong>Compra directa</strong>
        <p>WhatsApp o link de pago según la configuración de la tienda.</p>
      </article>
      <article>
        <strong>Atención cercana</strong>
        <p>Perfecto para marcas que venden por acompañamiento y confianza.</p>
      </article>
      <article>
        <strong>Admin simple</strong>
        <p>Panel para categorías, productos y datos de marca.</p>
      </article>
    </section>

    <section class="container editorial-grid section-block">
      <article class="editorial-card editorial-card-large">
        <p class="overline">Curaduría</p>
        <h2>Una portada más sobria, elegante y lista para mostrar.</h2>
        <p class="muted-copy">Pensada para que su demo se sienta más cercana a una boutique digital real y menos a una maqueta genérica.</p>
      </article>
      <article class="editorial-card editorial-card-accent">
        <p class="overline">Atención</p>
        <h3>Coordine pedidos con respuesta directa.</h3>
      </article>
      <article class="editorial-card editorial-card-soft">
        <p class="overline">Entrega</p>
        <h3>{{ store.settings.value?.shipping_note || 'Envíos coordinados a nivel nacional.' }}</h3>
      </article>
    </section>

    <section class="container section-block">
      <div class="section-head">
        <div>
          <p class="overline">Destacados</p>
          <h2>Piezas que abren la colección</h2>
        </div>
        <p class="muted-copy section-support">Una selección inicial con mejor presencia visual y llamadas a la acción más claras.</p>
      </div>
      <div class="product-grid">
        <ProductCard v-for="product in store.featured.value" :key="product.id" :product="product" @add="cart.add" />
      </div>
    </section>

    <section class="container section-block" id="catalogo">
      <div class="section-head catalog-head">
        <div>
          <p class="overline">Catálogo</p>
          <h2>Explore por categoría</h2>
        </div>
        <input v-model="store.search.value" class="search-input" type="search" placeholder="Buscar vestido, camisa, set..." />
      </div>

      <div class="filter-row">
        <button class="pill" :class="{ active: store.currentCategory.value === 'all' }" @click="store.currentCategory.value = 'all'">Todo</button>
        <button
          v-for="category in store.categories.value"
          :key="category.id"
          class="pill"
          :class="{ active: store.currentCategory.value === category.slug }"
          @click="store.currentCategory.value = category.slug"
        >
          {{ category.name }}
        </button>
      </div>

      <div class="product-grid">
        <ProductCard v-for="product in store.filteredProducts.value" :key="product.id" :product="product" @add="cart.add" />
      </div>
      <div v-if="!store.filteredProducts.value.length" class="empty-state">
        <h4>No encontramos productos</h4>
        <p>Pruebe con otra búsqueda o cambie la categoría.</p>
      </div>
    </section>

    <section class="container about-grid section-block" id="marca">
      <article class="about-card large-card">
        <p class="overline">Marca</p>
        <h2>{{ brandName }}</h2>
        <p>{{ store.settings.value?.shipping_note || 'Envíos y coordinación personalizada para que la experiencia de compra se sienta cercana y simple.' }}</p>
      </article>
      <article class="about-card">
        <p class="overline">Instagram</p>
        <p>{{ store.settings.value?.instagram || '@su_tienda' }}</p>
      </article>
      <article class="about-card" id="contacto">
        <p class="overline">Contacto</p>
        <p>{{ store.settings.value?.email || 'hola@su-tienda.com' }}</p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import ProductCard from '@/components/ProductCard.vue';
import { useCart } from '@/composables/useCart';
import { useStorefront } from '@/composables/useStorefront';

const store = useStorefront();
const cart = useCart();
const brandName = computed(() => store.settings.value?.brand_name?.trim() || 'Su marca');


function scrollToCatalog() {
  document.querySelector('#catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToBrand() {
  document.querySelector('#marca')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  if (!store.loaded.value) await store.loadStore();
});
</script>
