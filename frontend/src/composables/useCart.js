import { computed, reactive } from 'vue';
import { useToast } from './useToast';

const CART_KEY = 'vela-studio-cart';
const state = reactive({
  open: false,
  items: JSON.parse(localStorage.getItem(CART_KEY) || '[]'),
});

function save() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.items));
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

export function useCart() {
  const toast = useToast();

  const subtotal = computed(() => state.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0));
  const count = computed(() => state.items.reduce((sum, item) => sum + item.quantity, 0));

  function add(product, size = 'S') {
    const existing = state.items.find((item) => item.id === product.id && item.size === size);
    if (existing) {
      existing.quantity += 1;
    } else {
      state.items.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        size,
        quantity: 1,
      });
    }
    save();
    state.open = true;
    toast.success(`${product.name} se agregó a la bolsa.`);
  }

  function update(index, delta) {
    if (!state.items[index]) return;
    state.items[index].quantity += delta;
    if (state.items[index].quantity <= 0) state.items.splice(index, 1);
    save();
  }

  function remove(index) {
    const item = state.items[index];
    if (!item) return;
    state.items.splice(index, 1);
    save();
    toast.info(`${item.name} se quitó de la bolsa.`);
  }

  function clear() {
    state.items = [];
    save();
    toast.info('La bolsa se vació correctamente.');
  }

  function open() { state.open = true; }
  function close() { state.open = false; }

  function buildWhatsAppText() {
    const lines = state.items.map((item) => `• ${item.name} · Talla ${item.size} · x${item.quantity} · ${money(item.price * item.quantity)}`);
    return `Hola, quiero realizar este pedido:\n\n${lines.join('\n')}\n\nSubtotal: ${money(subtotal.value)}`;
  }

  return {
    state,
    subtotal,
    count,
    money,
    add,
    update,
    remove,
    clear,
    open,
    close,
    buildWhatsAppText,
  };
}
