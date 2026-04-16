const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
window.location.replace(slug ? `/producto/${encodeURIComponent(slug)}` : '/');
