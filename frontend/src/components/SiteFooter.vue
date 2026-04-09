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
        <span class="footer-title">Canales</span>
        <a v-if="instagramUrl" class="footer-contact-link" :href="instagramUrl" target="_blank" rel="noreferrer noopener">
          <span class="footer-contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>
          </span>
          <span>Instagram</span>
        </a>
        <a v-if="facebookUrl" class="footer-contact-link" :href="facebookUrl" target="_blank" rel="noreferrer noopener">
          <span class="footer-contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13.2 20V12.9H15.8L16.2 10.1H13.2V8.3C13.2 7.5 13.5 6.9 14.7 6.9H16.3V4.4C16 4.4 15.2 4.3 14.2 4.3C11.9 4.3 10.4 5.7 10.4 8.2V10.1H8V12.9H10.4V20H13.2Z" fill="currentColor"/></svg>
          </span>
          <span>Facebook</span>
        </a>
        <a v-if="whatsAppHref" class="footer-contact-link" :href="whatsAppHref" target="_blank" rel="noreferrer noopener">
          <span class="footer-contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12.1 4.2C7.9 4.2 4.5 7.6 4.5 11.8C4.5 13.4 5 14.9 5.9 16.2L5 19.8L8.7 18.9C9.9 19.7 11.3 20.2 12.9 20.2C17.1 20.2 20.5 16.8 20.5 12.6C20.5 8.4 17.1 4.2 12.1 4.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.7 9.3C9.9 8.9 10 8.9 10.3 8.9C10.5 8.9 10.7 8.9 10.9 8.9C11.1 8.9 11.3 9 11.4 9.3C11.5 9.6 11.9 10.6 12 10.8C12.1 11 12 11.2 11.9 11.4C11.8 11.5 11.7 11.7 11.5 11.8C11.4 11.9 11.3 12 11.5 12.3C11.7 12.6 12.2 13.4 13 14.1C14.1 15 15 15.3 15.3 15.4C15.6 15.5 15.8 15.4 15.9 15.3C16.1 15.1 16.5 14.6 16.7 14.4C16.9 14.2 17 14.2 17.3 14.3C17.6 14.4 19 15 19.3 15.1C19.6 15.2 19.8 15.3 19.8 15.5C19.8 15.8 19.7 16.6 19 17.2C18.4 17.8 17.5 18 16.7 17.8C15.9 17.6 13.8 16.8 12 15.2C10 13.4 8.9 11.1 8.6 10.4C8.4 9.8 8.7 9.6 8.9 9.4C9.1 9.3 9.3 9.1 9.5 8.9" fill="currentColor"/></svg>
          </span>
          <span>WhatsApp {{ formattedWhatsApp }}</span>
        </a>
        <a v-if="emailHref" class="footer-contact-link" :href="emailHref">
          <span class="footer-contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 7L12 12.4L19.5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span>{{ email }}</span>
        </a>
        <span v-if="shippingNote">{{ shippingNote }}</span>
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
const instagramUrl = computed(() => String(store.settings.value?.instagram_url || '').trim());
const facebookUrl = computed(() => String(store.settings.value?.facebook_url || '').trim());
const email = computed(() => String(store.settings.value?.email || '').trim());
const emailHref = computed(() => (email.value ? `mailto:${email.value}` : ''));
const shippingNote = computed(() => store.settings.value?.shipping_note || '');
const formattedWhatsApp = computed(() => {
  const digits = String(store.settings.value?.whatsapp_number || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
});
const whatsAppHref = computed(() => {
  const digits = String(store.settings.value?.whatsapp_number || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
});

onMounted(async () => {
  if (!store.loaded.value) await store.loadStore();
});
</script>
