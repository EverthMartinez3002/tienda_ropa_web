import { reactive, readonly } from 'vue';

const state = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
  showCancel: true,
  tone: 'default',
  dismissible: true,
});

let resolver = null;

function resolveAndReset(value) {
  state.open = false;
  const currentResolver = resolver;
  resolver = null;
  if (typeof currentResolver === 'function') currentResolver(value);
}

function openModal(config = {}) {
  if (resolver) resolveAndReset(false);

  Object.assign(state, {
    open: true,
    title: config.title || 'Confirmar acción',
    message: config.message || '',
    confirmText: config.confirmText || 'Aceptar',
    cancelText: config.cancelText || 'Cancelar',
    showCancel: config.showCancel ?? true,
    tone: config.tone || 'default',
    dismissible: config.dismissible ?? true,
  });

  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function useModal() {
  return {
    state: readonly(state),
    confirm(config = {}) {
      return openModal({
        title: 'Confirmar acción',
        confirmText: 'Continuar',
        cancelText: 'Cancelar',
        showCancel: true,
        tone: 'default',
        dismissible: true,
        ...config,
      });
    },
    notice(config = {}) {
      return openModal({
        title: 'Aviso',
        confirmText: 'Entendido',
        showCancel: false,
        tone: 'default',
        dismissible: true,
        ...config,
      });
    },
    accept() {
      resolveAndReset(true);
    },
    cancel() {
      resolveAndReset(false);
    },
    dismiss() {
      if (!state.dismissible) return;
      resolveAndReset(false);
    },
  };
}
