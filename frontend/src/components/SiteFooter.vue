<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <p class="overline">Boutique online</p>
        <h3>{{ brandName }}</h3>
        <p class="muted-copy">
          {{ brandTagline }}
        </p>
      </div>
      <div class="footer-links-col">
        <span class="footer-title">Explorar</span>
        <RouterLink to="/">Inicio</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#catalogo' }">Catálogo</RouterLink>
        <RouterLink :to="{ path: '/', hash: '#marca' }">Marca</RouterLink>
      </div>
      <div class="footer-links-col">
        <span class="footer-title">Contacto</span>
        <span>{{ store.settings.value?.email || 'hola@su-tienda.com' }}</span>
        <span>{{ store.settings.value?.instagram || '@su_tienda' }}</span>
        <span>{{ store.settings.value?.shipping_note || 'Envíos coordinados a nivel nacional.' }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useStorefront } from '@/composables/useStorefront';

const store = useStorefront();
const brandName = computed(() => store.settings.value?.brand_name || 'Su marca');
const brandTagline = computed(() => store.settings.value?.tagline || 'Una vitrina digital pensada para presentar colecciones con una estética más cuidada, atención directa y cierre simple por WhatsApp o link de pago.');

onMounted(async () => {
  if (!store.loaded.value) await store.loadStore();
});
</script>
