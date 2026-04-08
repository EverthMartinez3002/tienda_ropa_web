<template>
  <div class="app-shell">
    <SiteHeader />
    <router-view />
    <SiteFooter />
    <CartDrawer />
  </div>
</template>

<script setup>
import SiteHeader from '@/components/SiteHeader.vue';
import SiteFooter from '@/components/SiteFooter.vue';
import CartDrawer from '@/components/CartDrawer.vue';
</script>
