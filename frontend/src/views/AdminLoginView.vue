<template>
  <main class="container section-block admin-shell admin-login-shell">
    <section class="admin-login-hero">
      <div class="admin-login-copy">
        <p class="overline">Panel privado</p>
        <h1>Gestione su boutique con una base más seria.</h1>
        <p class="muted-copy">
          Ingrese para administrar productos, categorías, configuración de la marca y seguridad del panel.
        </p>
        <ul class="admin-login-points">
          <li>Gestión simple de catálogo</li>
          <li>Configuración de WhatsApp y pago</li>
          <li>Sesión segura y endurecida para demo</li>
        </ul>
      </div>

      <section class="admin-card login-card">
        <p class="overline">Admin</p>
        <h2>Ingresar al panel</h2>
        <p class="muted-copy">Use sus credenciales de administrador para continuar.</p>
        <form class="form-grid" @submit.prevent="submit">
          <label>
            <span>Correo</span>
            <input v-model="email" type="email" autocomplete="username" required />
          </label>
          <label>
            <span>Contraseña</span>
            <input v-model="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="btn btn-primary" type="submit" :disabled="loading">{{ loading ? 'Ingresando...' : 'Entrar' }}</button>
        </form>
      </section>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const { request } = useApi();
const toast = useToast();
const email = ref('');
const password = ref('');
const loading = ref(false);

onMounted(async () => {
  try {
    await request('/api/admin/session', { toastError: false });
    router.replace('/admin/panel');
  } catch (_error) {
    // ignore
  }
});

async function submit() {
  loading.value = true;
  try {
    await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value, password: password.value }),
      successMessage: 'Bienvenido al panel.',
    });
    router.push('/admin/panel');
  } catch (error) {
    toast.error(error.message);
  } finally {
    loading.value = false;
  }
}
</script>
