const card = document.querySelector('[data-retry-card]');
if (card) {
  const reference = card.getAttribute('data-reference');
  const btn = document.getElementById('retry-btn');
  const errEl = document.getElementById('retry-err');

  btn.addEventListener('click', async () => {
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Opening payment…';

    let json;
    try {
      const res = await fetch('/api/checkout/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      json = await res.json();
      if (!res.ok || !json.ok) {
        showError(json.error ?? 'Something went wrong. Try again.');
        return;
      }
    } catch (e) {
      showError('Network error. Please check your connection and try again.');
      return;
    }

    if (json.flow !== 'sdk') {
      showError('Unexpected payment flow. Please refresh and try again.');
      return;
    }
    if (!window.PayazaCheckout) {
      showError('Payment widget failed to load. Please refresh and try again.');
      return;
    }

    const boot = json.sdkBootstrap;
    const newRef = json.reference;
    const returnUrl = `/apply/return?reference=${encodeURIComponent(newRef)}`;
    const checkout = window.PayazaCheckout.setup({
      merchant_key: boot.publicKey,
      connection_mode: boot.connectionMode,
      checkout_amount: boot.amount,
      currency_code: boot.currency,
      email_address: boot.email,
      first_name: boot.firstName,
      last_name: boot.lastName,
      phone_number: boot.phoneNumber || '',
      transaction_reference: boot.reference,
      callback: () => { window.location.href = returnUrl; },
      onClose: () => {
        btn.disabled = false;
        btn.textContent = 'Retry payment';
      },
    });
    checkout.showPopup();
  });

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Retry payment';
  }
}
