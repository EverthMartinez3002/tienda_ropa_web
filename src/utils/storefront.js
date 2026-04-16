const {
  cleanText,
  slugify,
  validateHttpUrl,
  validateImageUrl,
  normalizeWhatsAppNumber,
  validateWhatsAppNumber,
  validateEmail,
  validateHexColor,
} = require('./security');

const SOCIAL_ALLOWED_HOSTS = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
};

const DEFAULT_THEME = {
  primary_color: '#1F2D38',
  secondary_color: '#DBC8B5',
  accent_color: '#B78465',
};

function isSafeMethod(method = 'GET') {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase());
}

function cleanPayloadString(value, max = 500) {
  return cleanText(value, max);
}

function socialAllowedHosts(platform = 'instagram') {
  return SOCIAL_ALLOWED_HOSTS[platform] || SOCIAL_ALLOWED_HOSTS.instagram;
}

function normalizeSocialUrl(value = '', platform = 'instagram') {
  const raw = cleanText(value, 220).replace(/\s+/g, '');
  if (!raw) return '';

  if (!/^https?:\/\//i.test(raw)) {
    const handle = raw.replace(/^@/, '').replace(/^\/+/, '');
    if (!handle) return '';
    const root = platform === 'facebook'
      ? 'https://www.facebook.com/'
      : 'https://www.instagram.com/';
    return `${root}${encodeURIComponent(handle)}`;
  }

  const validation = validateHttpUrl(raw, {
    httpsOnly: true,
    allowedHosts: socialAllowedHosts(platform),
  });

  return validation.ok ? validation.normalized : '';
}

function validatePaymentLink(value, env) {
  return validateHttpUrl(value, {
    httpsOnly: true,
    allowedHosts: env.paymentAllowedHosts,
  });
}

function resolveThemeColors(row = {}) {
  const primary = validateHexColor(row.primary_color || DEFAULT_THEME.primary_color);
  const secondary = validateHexColor(row.secondary_color || DEFAULT_THEME.secondary_color);
  const accent = validateHexColor(row.accent_color || DEFAULT_THEME.accent_color);

  return {
    primary_color: primary.ok ? primary.normalized : DEFAULT_THEME.primary_color,
    secondary_color: secondary.ok ? secondary.normalized : DEFAULT_THEME.secondary_color,
    accent_color: accent.ok ? accent.normalized : DEFAULT_THEME.accent_color,
  };
}

function sanitizeSettings(row, env) {
  if (!row) return null;
  const paymentValidation = validatePaymentLink(row.payment_link || '', env);
  const envEmail = validateEmail(env.envContactEmail || '');
  const theme = resolveThemeColors(row);

  return {
    brand_name: row.brand_name,
    tagline: row.tagline,
    whatsapp_number: normalizeWhatsAppNumber(env.envWhatsAppNumber || '') || normalizeWhatsAppNumber(row.whatsapp_number || ''),
    email: envEmail.ok ? envEmail.normalized : row.email,
    instagram_url: env.envInstagramUrl || normalizeSocialUrl(row.instagram_url || '', 'instagram'),
    facebook_url: env.envFacebookUrl || normalizeSocialUrl(row.facebook_url || '', 'facebook'),
    shipping_note: row.shipping_note,
    currency: row.currency,
    payment_enabled: paymentValidation.ok && Boolean(paymentValidation.normalized),
    ...theme,
  };
}

function sanitizeAdminSettings(row, env) {
  if (!row) return null;
  const publicSettings = sanitizeSettings(row, env);
  return {
    ...row,
    ...publicSettings,
    env_overrides: {
      whatsapp_number: Boolean(normalizeWhatsAppNumber(env.envWhatsAppNumber || '')),
      instagram_url: Boolean(env.envInstagramUrl),
      facebook_url: Boolean(env.envFacebookUrl),
      email: Boolean(validateEmail(env.envContactEmail || '').ok),
    },
  };
}

function normalizeProduct(row) {
  return {
    ...row,
    price: Number(row.price || 0),
    compare_at_price: row.compare_at_price == null ? null : Number(row.compare_at_price),
    sizes: String(row.sizes || 'S,M,L')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    featured: Boolean(row.featured),
    is_active: Boolean(row.is_active),
  };
}

function normalizeProductPayload(body = {}) {
  const name = cleanPayloadString(body.name || '', 180);
  const slug = slugify(body.slug || name);
  const categoryIdRaw = body.category_id;
  const categoryId = categoryIdRaw === '' || categoryIdRaw == null ? null : Number(categoryIdRaw);
  const price = Number(body.price || 0);
  const compare = body.compare_at_price === '' || body.compare_at_price == null ? null : Number(body.compare_at_price);
  const shortDescription = cleanPayloadString(body.short_description || '', 220);
  const description = cleanPayloadString(body.description || '', 2000);
  const imageValidation = validateImageUrl(body.image_url || '');
  const tag = cleanPayloadString(body.tag || '', 80);
  const sizes = String(body.sizes || 'S,M,L')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .join(',');
  const featured = Boolean(body.featured);
  const isActive = Boolean(body.is_active ?? true);

  if (!name) return { ok: false, error: 'Debe ingresar el nombre del producto.' };
  if (!slug) return { ok: false, error: 'No se pudo generar un slug válido.' };
  if (categoryId != null && (!Number.isInteger(categoryId) || categoryId <= 0)) return { ok: false, error: 'Categoría inválida.' };
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'El precio es inválido.' };
  if (compare != null && (!Number.isFinite(compare) || compare < 0)) return { ok: false, error: 'El precio anterior es inválido.' };
  if (!imageValidation.ok) return { ok: false, error: imageValidation.reason || 'La imagen es inválida.' };
  if (!sizes) return { ok: false, error: 'Debe indicar al menos una talla.' };

  return {
    ok: true,
    value: {
      name,
      slug,
      categoryId,
      price,
      compare,
      shortDescription,
      description,
      imageUrl: imageValidation.normalized,
      tag,
      sizes,
      featured,
      isActive,
    },
  };
}

function normalizeSettingsPayload(body = {}, env) {
  const brandName = cleanPayloadString(body.brand_name || '', 120);
  const tagline = cleanPayloadString(body.tagline || '', 240);
  const whatsappInput = validateWhatsAppNumber(body.whatsapp_number || '');
  const emailValidation = validateEmail(cleanPayloadString(body.email || '', 180).toLowerCase());
  const instagramUrl = normalizeSocialUrl(body.instagram_url || '', 'instagram');
  const facebookUrl = normalizeSocialUrl(body.facebook_url || '', 'facebook');
  const shippingNote = cleanPayloadString(body.shipping_note || '', 500);
  const currency = cleanPayloadString(body.currency || 'USD', 12).toUpperCase();
  const paymentValidation = validatePaymentLink(body.payment_link || '', env);
  const primaryColor = validateHexColor(body.primary_color || DEFAULT_THEME.primary_color);
  const secondaryColor = validateHexColor(body.secondary_color || DEFAULT_THEME.secondary_color);
  const accentColor = validateHexColor(body.accent_color || DEFAULT_THEME.accent_color);

  if (!brandName) return { ok: false, error: 'Debe ingresar el nombre de la marca.' };
  if (!tagline) return { ok: false, error: 'Debe ingresar el tagline.' };
  if (!normalizeWhatsAppNumber(env.envWhatsAppNumber || '') && !whatsappInput.ok) {
    return { ok: false, error: whatsappInput.reason || 'WhatsApp inválido.' };
  }
  if (!validateEmail(env.envContactEmail || '').ok && !emailValidation.ok) {
    return { ok: false, error: 'Correo inválido.' };
  }
  if (!paymentValidation.ok) return { ok: false, error: paymentValidation.reason || 'Link de pago inválido.' };
  if (!env.envInstagramUrl && body.instagram_url && !instagramUrl) {
    return { ok: false, error: 'La URL de Instagram no es válida.' };
  }
  if (!env.envFacebookUrl && body.facebook_url && !facebookUrl) {
    return { ok: false, error: 'La URL de Facebook no es válida.' };
  }
  if (!primaryColor.ok) return { ok: false, error: primaryColor.reason };
  if (!secondaryColor.ok) return { ok: false, error: secondaryColor.reason };
  if (!accentColor.ok) return { ok: false, error: accentColor.reason };

  return {
    ok: true,
    value: {
      brandName,
      tagline,
      whatsappNumber: normalizeWhatsAppNumber(env.envWhatsAppNumber || '') || whatsappInput.normalized,
      email: validateEmail(env.envContactEmail || '').ok ? validateEmail(env.envContactEmail || '').normalized : emailValidation.normalized,
      instagramUrl: env.envInstagramUrl || instagramUrl,
      facebookUrl: env.envFacebookUrl || facebookUrl,
      shippingNote,
      currency,
      paymentLink: paymentValidation.normalized,
      primaryColor: primaryColor.normalized,
      secondaryColor: secondaryColor.normalized,
      accentColor: accentColor.normalized,
    },
  };
}

module.exports = {
  DEFAULT_THEME,
  isSafeMethod,
  cleanPayloadString,
  normalizeSocialUrl,
  validatePaymentLink,
  sanitizeSettings,
  sanitizeAdminSettings,
  normalizeProduct,
  normalizeProductPayload,
  normalizeSettingsPayload,
  resolveThemeColors,
};
