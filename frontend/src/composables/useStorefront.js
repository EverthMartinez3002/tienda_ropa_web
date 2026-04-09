import { computed, reactive, toRefs } from 'vue';
import { useApi } from './useApi';

const state = reactive({
  loaded: false,
  settings: null,
  categories: [],
  products: [],
  featured: [],
  currentCategory: 'all',
  search: '',
});

export function useStorefront() {
  const { request } = useApi();

  const filteredProducts = computed(() => {
    const term = state.search.trim().toLowerCase();
    return state.products.filter((product) => {
      const byCategory = state.currentCategory === 'all' || product.category_slug === state.currentCategory;
      const haystack = [product.name, product.short_description, product.description, product.category_name].join(' ').toLowerCase();
      const bySearch = !term || haystack.includes(term);
      return byCategory && bySearch;
    });
  });

  async function loadStore() {
    const [settings, categories, products, featured] = await Promise.all([
      request('/api/public/settings'),
      request('/api/public/categories'),
      request('/api/public/products'),
      request('/api/public/products?featured=true'),
    ]);

    state.settings = settings;
    if (typeof document !== 'undefined') {
      const titleBrand = settings?.brand_name?.trim() || 'Su marca';
      document.title = `${titleBrand} · Boutique online`;
    }
    state.categories = categories;
    state.products = products;
    state.featured = featured;
    state.loaded = true;
  }

  async function loadProduct(slug) {
    const product = await request(`/api/public/products/${encodeURIComponent(slug)}`);
    if (typeof document !== 'undefined') {
      const titleBrand = state.settings?.brand_name?.trim() || 'Su marca';
      document.title = product?.name ? `${product.name} · ${titleBrand}` : `${titleBrand} · Boutique online`;
    }
    return product;
  }

  return {
    ...toRefs(state),
    filteredProducts,
    loadStore,
    loadProduct,
  };
}
