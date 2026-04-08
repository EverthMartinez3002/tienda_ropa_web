import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import ProductView from '@/views/ProductView.vue';
import AdminLoginView from '@/views/AdminLoginView.vue';
import AdminDashboardView from '@/views/AdminDashboardView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/producto/:slug', name: 'product', component: ProductView },
    { path: '/admin', redirect: '/admin/login' },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    { path: '/admin/panel', name: 'admin-panel', component: AdminDashboardView },
  ],
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' };
  },
});

export default router;
