const meta = document.querySelector('meta[name="turnstile-site-key"]');
const turnstileSiteKey = meta ? meta.getAttribute('content') : '';
import('./apply-form.js?v=checkout-retry-20260915').then(m => m.init({ turnstileSiteKey }));
