const meta = document.querySelector('meta[name="turnstile-site-key"]');
const turnstileSiteKey = meta ? meta.getAttribute('content') : '';
import('./apply-form.js').then(m => m.init({ turnstileSiteKey }));
