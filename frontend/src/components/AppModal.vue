<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="modal.state.open" class="modal-overlay" @click="modal.dismiss()">
        <div class="modal-card" :class="`modal-${modal.state.tone}`" role="dialog" aria-modal="true" :aria-labelledby="modalTitleId" @click.stop>
          <button class="modal-close" type="button" aria-label="Cerrar" @click="modal.dismiss()">✕</button>

          <div class="modal-badge" :class="`modal-badge-${modal.state.tone}`">
            {{ badgeLabel }}
          </div>

          <h3 :id="modalTitleId">{{ modal.state.title }}</h3>
          <p class="modal-message">{{ modal.state.message }}</p>

          <div class="modal-actions">
            <button v-if="modal.state.showCancel" class="btn btn-secondary" type="button" @click="modal.cancel()">
              {{ modal.state.cancelText }}
            </button>
            <button class="btn" :class="confirmButtonClass" type="button" @click="modal.accept()">
              {{ modal.state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useModal } from '@/composables/useModal';

const modal = useModal();
const modalTitleId = 'global-app-modal-title';

const badgeLabel = computed(() => {
  if (modal.state.tone === 'danger') return 'Confirmación';
  if (modal.state.tone === 'success') return 'Completado';
  return 'Aviso';
});

const confirmButtonClass = computed(() => {
  if (modal.state.tone === 'danger') return 'btn-danger-solid';
  return 'btn-primary';
});

function handleKeydown(event) {
  if (event.key === 'Escape' && modal.state.open) modal.dismiss();
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>
