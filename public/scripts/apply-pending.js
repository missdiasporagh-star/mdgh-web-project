// Pending-state resolver for /apply/return. Polls the verify endpoint a few
// times so a slow-but-real payment resolves and redirects hands-free. If it
// never resolves, reveals the retry/recheck controls so the applicant is never
// stranded. Never auto-fails a pending payment (no double-charge risk).
const card = document.querySelector('[data-pending-card]');
if (card) {
  const reference = card.getAttribute('data-reference');
  const actions = document.getElementById('pending-actions');
  const heading = document.getElementById('pending-heading');
  const msg = document.getElementById('pending-msg');
  const recheckBtn = document.getElementById('recheck-btn');

  const MAX_ATTEMPTS = 6;
  const INTERVAL_MS = 4000;
  let attempts = 0;
  let polling = true;

  async function checkOnce() {
    try {
      const res = await fetch(
        `/api/checkout/verify?reference=${encodeURIComponent(reference)}&_cb=${Date.now()}`,
      );
      if (res.status === 429) return 'stop';
      const json = await res.json();
      if (json.ok && json.status === 'paid' && json.token) {
        window.location.href = `/apply/form?token=${encodeURIComponent(json.token)}`;
        return 'done';
      }
      if (json.ok && json.status === 'failed') return 'stop';
      return 'pending';
    } catch (e) {
      return 'stop';
    }
  }

  function reveal() {
    polling = false;
    if (heading) heading.textContent = "We couldn't confirm your payment yet.";
    if (msg) msg.style.display = 'none';
    if (actions) actions.style.display = 'block';
  }

  async function poll() {
    while (polling && attempts < MAX_ATTEMPTS) {
      attempts++;
      const result = await checkOnce();
      if (result === 'done') return;
      if (result === 'stop') { reveal(); return; }
      if (attempts >= MAX_ATTEMPTS) { reveal(); return; }
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  if (recheckBtn) {
    recheckBtn.addEventListener('click', async () => {
      recheckBtn.disabled = true;
      recheckBtn.textContent = 'Checking…';
      const result = await checkOnce();
      if (result !== 'done') {
        recheckBtn.disabled = false;
        recheckBtn.textContent = 'Check again';
      }
    });
  }

  poll();
}
