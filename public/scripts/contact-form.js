// Homepage contact form — Resend-backed, Turnstile-protected.
// Replaces the EmailJS browser-side integration. Submits to /api/contact.

(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoading = document.getElementById('btnLoading');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  // Turnstile site key from a meta tag injected by index.astro
  const siteKeyMeta = document.querySelector('meta[name="turnstile-site-key"]');
  const siteKey = siteKeyMeta ? siteKeyMeta.getAttribute('content') : null;

  let turnstileToken = null;

  function setSubmitEnabled() {
    submitBtn.disabled = !turnstileToken;
  }

  // Render Turnstile widget once the script loads
  const turnstileHost = document.getElementById('contact-turnstile-host');
  if (siteKey && turnstileHost) {
    submitBtn.disabled = true; // until human verified
    const renderInterval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(renderInterval);
        window.turnstile.render(turnstileHost, {
          sitekey: siteKey,
          callback: (token) => {
            turnstileToken = token;
            setSubmitEnabled();
          },
          'expired-callback': () => {
            turnstileToken = null;
            setSubmitEnabled();
          },
          'error-callback': () => {
            turnstileToken = null;
            setSubmitEnabled();
          },
        });
      }
    }, 100);
  } else {
    // No site key configured — leave submit enabled but server will reject
    // any submission with an invalid Turnstile token (defence in depth).
    console.warn('[contact-form] Turnstile site key not found on page');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    successMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');

    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
      const body = {
        name: form.querySelector('[name="name"]').value,
        email: form.querySelector('[name="email"]').value,
        subject: form.querySelector('[name="subject"]').value,
        message: form.querySelector('[name="message"]').value,
        honeypot: form.querySelector('[name="honeypot"]').value,
        turnstileToken: turnstileToken || '',
      };

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const reason =
          json.error === 'rate_limited'
            ? 'You\'ve sent too many messages recently. Try again in an hour.'
            : json.error === 'turnstile_failed'
            ? 'Couldn\'t verify you\'re human. Refresh the page and try again.'
            : json.error === 'invalid_input'
            ? 'Please check the form fields and try again.'
            : json.error === 'send_failed'
            ? 'Couldn\'t deliver the message. Please try again or reach out via WhatsApp.'
            : 'Something went wrong. Please try again or contact us via WhatsApp.';
        if (errorText) errorText.textContent = reason;
        errorMessage.classList.remove('hidden');
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      successMessage.classList.remove('hidden');
      form.reset();
      successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Reset Turnstile so the user can send another message
      turnstileToken = null;
      if (window.turnstile && turnstileHost) {
        try { window.turnstile.reset(turnstileHost); } catch {}
      }
      setTimeout(() => successMessage.classList.add('hidden'), 5000);
    } catch (err) {
      if (errorText) errorText.textContent = 'Network error. Check your connection and try again.';
      errorMessage.classList.remove('hidden');
      console.error('[contact-form] submit error', err);
    } finally {
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
      setSubmitEnabled();
    }
  });
})();
