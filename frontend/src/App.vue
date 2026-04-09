<template>
  <div class="app-shell">
    <SiteHeader />
    <router-view />
    <SiteFooter />
    <CartDrawer />
    <AppModal />
  </div>
</template>

<script setup>
import SiteHeader from '@/components/SiteHeader.vue';
import SiteFooter from '@/components/SiteFooter.vue';
import CartDrawer from '@/components/CartDrawer.vue';
import AppModal from '@/components/AppModal.vue';
</script>
