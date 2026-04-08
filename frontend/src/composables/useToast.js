import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

function baseToast(message, type = 'info') {
  const palette = {
    success: 'linear-gradient(135deg, #18222f, #1f5f4f)',
    error: 'linear-gradient(135deg, #5f2020, #aa3d3d)',
    info: 'linear-gradient(135deg, #1f2430, #4d5a79)',
    warning: 'linear-gradient(135deg, #5f451d, #b8842f)',
  };

  Toastify({
    text: String(message || '').trim(),
    duration: type === 'error' ? 4200 : 2800,
    gravity: 'top',
    position: 'right',
    stopOnFocus: true,
    close: true,
    style: {
      background: palette[type] || palette.info,
      borderRadius: '14px',
      boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
      fontWeight: '600',
    },
    offset: { x: 18, y: 18 },
  }).showToast();
}

export function useToast() {
  return {
    success: (message) => baseToast(message, 'success'),
    error: (message) => baseToast(message, 'error'),
    info: (message) => baseToast(message, 'info'),
    warning: (message) => baseToast(message, 'warning'),
  };
}
