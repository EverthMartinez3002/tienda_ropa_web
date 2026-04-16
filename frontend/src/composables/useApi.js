import { useToast } from './useToast';

function getCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function useApi() {
  const toast = useToast();

  async function request(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (options.body && !isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && url.startsWith('/api/admin/')) {
      const csrf = getCookie('__Host-admin_csrf') || getCookie('admin_csrf');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    let response;
    try {
      response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        method,
        headers,
      });
    } catch (_error) {
      const message = 'No se pudo conectar con el servidor.';
      if (options.toastError !== false) toast.error(message);
      throw new Error(message);
    }

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    try {
      data = contentType.includes('application/json') ? await response.json() : null;
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error || 'No se pudo completar la operación';
      if (options.toastError !== false) toast.error(message);
      throw new Error(message);
    }

    if (options.successMessage) toast.success(options.successMessage);
    return data;
  }

  return { request, getCookie };
}
