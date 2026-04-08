<template>
  <header class="site-header" :class="{ 'nav-scrolled': scrolled }">
    <div class="announcement-bar">
      <div class="container announcement-inner">
        <span>Colección actualizada · compra directa por WhatsApp o link de pago</span>
        <span class="desktop-only">Atención personalizada y experiencia de compra simple</span>
      </div>
    </div>

    <div class="container nav-inner">
      <RouterLink to="/" class="brand-link" @click="closeSheet">
        <span class="brand-mark">{{ brandInitial }}</span>
        <span class="brand-meta">
          <strong class="brand-name">{{ brandName }}</strong>
          <small class="brand-caption">Boutique online</small>
        </span>
      </RouterLink>

      <nav class="nav-links desktop-only">
        <button type="button" class="nav-link-btn" @click="goToHash('#nuevo')">Lo nuevo</button>
        <button type="button" class="nav-link-btn" @click="goToHash('#catalogo')">Catálogo</button>
        <button type="button" class="nav-link-btn" @click="goToHash('#marca')">Marca</button>
        <button type="button" class="nav-link-btn" @click="goToHash('#contacto')">Contacto</button>
      </nav>

      <div class="nav-actions">
        <button class="icon-btn mobile-only" type="button" @click="sheetOpen = !sheetOpen">☰</button>
        <button class="cart-chip" type="button" @click="cart.open()">
          Bolsa <span>{{ cart.count.value }}</span>
        </button>
      </div>
    </div>

    <div v-if="sheetOpen" class="mobile-sheet" @click.self="closeSheet">
      <div class="mobile-card">
        <button type="button" class="mobile-nav-btn" @click="goToHash('#nuevo')">Lo nuevo</button>
        <button type="button" class="mobile-nav-btn" @click="goToHash('#catalogo')">Catálogo</button>
        <button type="button" class="mobile-nav-btn" @click="goToHash('#marca')">Marca</button>
        <button type="button" class="mobile-nav-btn" @click="goToHash('#contacto')">Contacto</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useCart } from '@/composables/useCart';
import { useStorefront } from '@/composables/useStorefront';

const cart = useCart();
const store = useStorefront();
const router = useRouter();
const scrolled = ref(false);
const sheetOpen = ref(false);
const brandName = computed(() => store.settings.value?.brand_name || 'Su marca');
const brandInitial = computed(() => brandName.value.trim().charAt(0).toUpperCase() || 'S');

function updateScroll() {
  scrolled.value = window.scrollY > 14;
}

function closeSheet() {
  sheetOpen.value = false;
}

async function goToHash(hash) {
  closeSheet();
  if (router.currentRoute.value.path !== '/') {
    await router.push({ path: '/', hash });
  } else {
    window.history.replaceState({}, '', hash);
  }

  await nextTick();
  const target = document.querySelector(hash);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onKey(event) {
  if (event.key === 'Escape') closeSheet();
}

onMounted(async () => {
  if (!store.loaded.value) {
    try { await store.loadStore(); } catch (_error) {}
  }
  updateScroll();
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScroll);
  window.removeEventListener('keydown', onKey);
});
</script>
