function getCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openExternal(url) {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
}

function applyBrandName(brandName) {
  const name = String(brandName || '').trim();
  if (!name) return;

  document.querySelectorAll('[data-brand-name]').forEach((node) => {
    node.textContent = name;
  });

  document.querySelectorAll('[data-brand-logo-alt]').forEach((node) => {
    node.setAttribute('alt', name);
  });
}

async function request(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && url.startsWith('/api/admin/')) {
    const csrf = getCookie('__Host-admin_csrf') || getCookie('admin_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    method,
    headers,
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  try {
    data = contentType.includes('application/json') ? await response.json() : null;
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo completar la operación');
  }
  return data;
}

window.api = {
  getCookie,
  escapeHtml,
  openExternal,
  applyBrandName,
  request,
};

(function () {
  const STYLE_ID = 'app-ui-style';
  const TOAST_REGION_ID = 'app-toast-region';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .app-toast-region {
        position: fixed;
        right: 1.15rem;
        bottom: 1.15rem;
        z-index: 9999;
        display: grid;
        gap: .65rem;
        max-width: min(420px, calc(100vw - 2.3rem));
        pointer-events: none;
      }
      .app-toast {
        pointer-events: auto;
        padding: .95rem 1.05rem;
        border-radius: var(--radius-md, 18px);
        background: var(--surface-solid, var(--surface));
        border: 1px solid var(--line-strong, var(--line));
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
        color: var(--text);
      }
      .app-toast__title { margin: 0 0 .2rem; font-weight: 800; font-size: .95rem; }
      .app-toast__msg { margin: 0; color: var(--muted, var(--text)); line-height: 1.45; white-space: pre-line; }
      .app-toast__close {
        float: right;
        margin-left: .75rem;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--text) 6%, transparent);
        border: 1px solid var(--line);
        color: inherit;
      }
      .app-dialog-host {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: grid;
        place-items: center;
        padding: 1.25rem;
      }
      .app-dialog {
        width: min(560px, 100%);
        border-radius: var(--radius-lg, 24px);
        background: var(--surface-solid, var(--surface));
        border: 1px solid var(--line-strong, var(--line));
        box-shadow: var(--shadow);
        backdrop-filter: blur(20px);
        padding: 1.15rem;
      }
      .app-dialog__title { margin: 0 0 .55rem; font-weight: 800; }
      .app-dialog__body { margin: 0; color: var(--muted, var(--text)); line-height: 1.6; white-space: pre-line; }
      .app-dialog__actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1rem; }
    `;
    document.head.appendChild(style);
  }

  function getToastRegion() {
    let region = document.getElementById(TOAST_REGION_ID);
    if (region) return region;

    region = document.createElement('div');
    region.id = TOAST_REGION_ID;
    region.className = 'app-toast-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(region);
    return region;
  }

  function toast(message, options = {}) {
    ensureStyles();

    const variant = String(options.variant || 'info');
    const title = String(options.title || '').trim();
    const text = String(message || '').trim();
    if (!text) return;

    const region = getToastRegion();
    const node = document.createElement('div');
    node.className = `app-toast app-toast--${variant}`;
    node.setAttribute('role', variant === 'error' ? 'alert' : 'status');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'app-toast__close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '✕';

    const titleEl = title ? document.createElement('p') : null;
    if (titleEl) {
      titleEl.className = 'app-toast__title';
      titleEl.textContent = title;
    }

    const msgEl = document.createElement('p');
    msgEl.className = 'app-toast__msg';
    msgEl.textContent = text;

    closeBtn.addEventListener('click', () => node.remove());
    node.appendChild(closeBtn);
    if (titleEl) node.appendChild(titleEl);
    node.appendChild(msgEl);

    region.appendChild(node);

    const durationMs = Number(options.durationMs || (variant === 'error' ? 4200 : 2600));
    window.setTimeout(() => {
      if (!node.isConnected) return;
      node.remove();
    }, Math.max(1200, durationMs));
  }

  function dialog(options = {}) {
    ensureStyles();

    const title = String(options.title || '').trim();
    const message = String(options.message || '').trim();
    const closeText = String(options.closeText || 'Cerrar');

    const overlayClass = document.querySelector('.overlay')
      ? 'overlay'
      : (document.querySelector('.drawer-overlay') ? 'drawer-overlay' : 'overlay');

    const overlay = document.createElement('div');
    overlay.className = overlayClass;
    overlay.style.zIndex = '9999';
    overlay.addEventListener('click', close);

    const host = document.createElement('div');
    host.className = 'app-dialog-host';

    const card = document.createElement('div');
    card.className = 'app-dialog';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h3');
    titleEl.className = 'app-dialog__title';
    titleEl.textContent = title || 'Mensaje';

    const bodyEl = document.createElement('p');
    bodyEl.className = 'app-dialog__body';
    bodyEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'app-dialog__actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = document.querySelector('.btn') ? 'btn btn-primary' : 'btn';
    closeBtn.textContent = closeText;
    closeBtn.addEventListener('click', close);

    actions.appendChild(closeBtn);
    card.appendChild(titleEl);
    if (message) card.appendChild(bodyEl);
    card.appendChild(actions);
    host.appendChild(card);

    function onKeyDown(event) {
      if (event.key === 'Escape') close();
    }

    function close() {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      host.remove();
    }

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    document.body.appendChild(host);

    closeBtn.focus();
    return { close };
  }

  function confirmDialog(options = {}) {
    ensureStyles();

    const title = String(options.title || '').trim();
    const message = String(options.message || '').trim();
    const confirmText = String(options.confirmText || 'Confirmar');
    const cancelText = String(options.cancelText || 'Cancelar');
    const danger = Boolean(options.danger);

    const overlayClass = document.querySelector('.overlay')
      ? 'overlay'
      : (document.querySelector('.drawer-overlay') ? 'drawer-overlay' : 'overlay');

    const overlay = document.createElement('div');
    overlay.className = overlayClass;
    overlay.style.zIndex = '9999';

    const host = document.createElement('div');
    host.className = 'app-dialog-host';

    const card = document.createElement('div');
    card.className = 'app-dialog';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h3');
    titleEl.className = 'app-dialog__title';
    titleEl.textContent = title || 'Confirmación';

    const bodyEl = document.createElement('p');
    bodyEl.className = 'app-dialog__body';
    bodyEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'app-dialog__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = document.querySelector('.btn') ? 'btn btn-secondary' : 'btn';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    if (document.querySelector('.btn')) {
      confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    } else {
      confirmBtn.className = 'btn';
    }
    confirmBtn.textContent = confirmText;

    card.appendChild(titleEl);
    if (message) card.appendChild(bodyEl);
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(actions);
    host.appendChild(card);

    return new Promise((resolve) => {
      function cleanup(result) {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        host.remove();
        resolve(Boolean(result));
      }

      function onKeyDown(event) {
        if (event.key === 'Escape') cleanup(false);
      }

      overlay.addEventListener('click', () => cleanup(false));
      cancelBtn.addEventListener('click', () => cleanup(false));
      confirmBtn.addEventListener('click', () => cleanup(true));
      document.addEventListener('keydown', onKeyDown);

      document.body.appendChild(overlay);
      document.body.appendChild(host);
      cancelBtn.focus();
    });
  }

  window.ui = window.ui || {};
  window.ui.toast = window.ui.toast || toast;
  window.ui.dialog = window.ui.dialog || dialog;
  window.ui.confirm = window.ui.confirm || confirmDialog;
})();
