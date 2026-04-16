const DEFAULT_THEME = {
  primary_color: '#1F2D38',
  secondary_color: '#DBC8B5',
  accent_color: '#B78465',
};

export const THEME_PRESETS = [
  { key: 'atelier', label: 'Atelier', description: 'Elegante y sobrio.', primary_color: '#1F2D38', secondary_color: '#DBC8B5', accent_color: '#B78465' },
  { key: 'rose', label: 'Rose', description: 'Femenino y suave.', primary_color: '#6C375E', secondary_color: '#F1D6DE', accent_color: '#D98E9D' },
  { key: 'emerald', label: 'Emerald', description: 'Natural y premium.', primary_color: '#1F4D3A', secondary_color: '#D9E9DD', accent_color: '#78A67E' },
  { key: 'terra', label: 'Terra', description: 'Cálido y artesanal.', primary_color: '#6A4032', secondary_color: '#EAD2C1', accent_color: '#C77C58' },
  { key: 'midnight', label: 'Midnight', description: 'Oscuro y moderno.', primary_color: '#18212B', secondary_color: '#D3DAE3', accent_color: '#7AA2D3' },
  { key: 'lavender', label: 'Lavender', description: 'Suave y contemporáneo.', primary_color: '#4A4672', secondary_color: '#E5E0F5', accent_color: '#9E8CE0' },
];

function normalizeHexColor(value, fallback) {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixWith(hex, targetHex, amount = 0.5) {
  const source = hexToRgb(hex);
  const target = hexToRgb(targetHex);
  const weight = Math.min(1, Math.max(0, amount));
  const r = Math.round(source.r + (target.r - source.r) * weight);
  const g = Math.round(source.g + (target.g - source.g) * weight);
  const b = Math.round(source.b + (target.b - source.b) * weight);
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function resolveTheme(theme = {}) {
  const primary = normalizeHexColor(theme.primary_color, DEFAULT_THEME.primary_color);
  const secondary = normalizeHexColor(theme.secondary_color, DEFAULT_THEME.secondary_color);
  const accent = normalizeHexColor(theme.accent_color, DEFAULT_THEME.accent_color);
  return {
    primary_color: primary,
    secondary_color: secondary,
    accent_color: accent,
    primary_soft: mixWith(primary, '#FFFFFF', 0.24),
    primary_strong: mixWith(primary, '#000000', 0.34),
    accent_strong: mixWith(accent, '#000000', 0.2),
    secondary_soft: mixWith(secondary, '#FFFFFF', 0.45),
    primary_rgb: hexToRgb(primary),
    secondary_rgb: hexToRgb(secondary),
    accent_rgb: hexToRgb(accent),
  };
}

export function applyThemeToDocument(theme = {}) {
  if (typeof document === 'undefined') return resolveTheme(theme);
  const resolved = resolveTheme(theme);
  const style = document.documentElement.style;
  style.setProperty('--primary', resolved.primary_color);
  style.setProperty('--primary-soft', resolved.primary_soft);
  style.setProperty('--primary-strong', resolved.primary_strong);
  style.setProperty('--secondary', resolved.secondary_color);
  style.setProperty('--secondary-soft', resolved.secondary_soft);
  style.setProperty('--accent', resolved.accent_color);
  style.setProperty('--accent-strong', resolved.accent_strong);
  style.setProperty('--primary-rgb', `${resolved.primary_rgb.r}, ${resolved.primary_rgb.g}, ${resolved.primary_rgb.b}`);
  style.setProperty('--secondary-rgb', `${resolved.secondary_rgb.r}, ${resolved.secondary_rgb.g}, ${resolved.secondary_rgb.b}`);
  style.setProperty('--accent-rgb', `${resolved.accent_rgb.r}, ${resolved.accent_rgb.g}, ${resolved.accent_rgb.b}`);
  return resolved;
}
