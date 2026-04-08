<template>
  <div>
    <div v-if="cart.state.open" class="drawer-overlay" @click="cart.close()"></div>
    <aside class="cart-drawer" :class="{ open: cart.state.open }" aria-label="Bolsa de compras">
      <div class="drawer-top">
        <div>
          <p class="overline">Pedido</p>
          <h3>Su bolsa</h3>
        </div>
        <button class="icon-btn" type="button" @click="cart.close()">✕</button>
      </div>

      <div v-if="cart.state.items.length" class="drawer-list">
        <article v-for="(item, index) in cart.state.items" :key="`${item.id}-${item.size}`" class="cart-item">
          <img :src="item.image_url" :alt="item.name" />
          <div class="cart-copy">
            <strong>{{ item.name }}</strong>
            <p>Talla {{ item.size }}</p>
            <p>{{ cart.money(item.price) }}</p>
            <div class="qty-row">
              <button type="button" @click="cart.update(index, -1)">−</button>
              <span>{{ item.quantity }}</span>
              <button type="button" @click="cart.update(index, 1)">+</button>
              <button type="button" class="link-danger" @click="cart.remove(index)">Quitar</button>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="empty-state drawer-empty">
        <h4>Su bolsa está vacía</h4>
        <p>Agregue las piezas que más le gusten antes de continuar.</p>
      </div>

      <div class="drawer-bottom">
        <div class="summary-row">
          <span>Subtotal</span>
          <strong>{{ cart.money(cart.subtotal.value) }}</strong>
        </div>
        <button class="btn btn-secondary" type="button" @click="handleClear">Vaciar bolsa</button>
        <button class="btn btn-primary" type="button" @click="checkoutWhatsApp">Finalizar por WhatsApp</button>
        <button class="btn btn-dark" type="button" @click="checkoutPayment">Ir al link de pago</button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useCart } from '@/composables/useCart';
import { useStorefront } from '@/composables/useStorefront';
import { useToast } from '@/composables/useToast';

const cart = useCart();
const store = useStorefront();
const toast = useToast();

function handleClear() {
  if (!cart.state.items.length) return;
  if (window.confirm('¿Desea vaciar la bolsa?')) cart.clear();
}

function checkoutWhatsApp() {
  if (!cart.state.items.length) {
    toast.info('Primero agregue al menos un producto a la bolsa.');
    return;
  }
  const number = String(store.settings.value?.whatsapp_number || '').replace(/\D/g, '');
  if (!number) {
    toast.error('No se ha configurado el número de WhatsApp.');
    return;
  }
  const target = `https://wa.me/${number}?text=${encodeURIComponent(cart.buildWhatsAppText())}`;
  window.open(target, '_blank', 'noopener,noreferrer');
}

function checkoutPayment() {
  if (!cart.state.items.length) {
    toast.info('Primero agregue al menos un producto a la bolsa.');
    return;
  }
  if (!store.settings.value?.payment_enabled) {
    toast.error('No se ha configurado un link de pago seguro.');
    return;
  }
  window.open('/checkout/payment', '_blank', 'noopener,noreferrer');
}


onMounted(async () => {
  if (!store.loaded.value) await store.loadStore();
});
</script>
