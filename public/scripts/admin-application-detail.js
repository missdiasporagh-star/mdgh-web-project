const meta = document.querySelector('meta[name="application-id"]');
const id = meta ? meta.getAttribute('content') : '';

document.getElementById('status-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('status-select').value;
  const adminNotes = document.getElementById('admin-notes').value;
  const msg = document.getElementById('status-msg');
  msg.style.display = 'block';
  const res = await fetch(`/api/admin/applications/${id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, adminNotes }),
  });
  if (res.ok) { msg.className = 'ok'; msg.textContent = 'Saved.'; }
  else { msg.className = 'err'; msg.textContent = 'Could not save.'; }
});

async function previewMedia(appId, which) {
  const host = document.getElementById('media-host');
  host.innerHTML = '<p class="muted">Loading…</p>';
  const res = await fetch(`/api/admin/applications/${appId}/signed-url?which=${which}`);
  const j = await res.json();
  if (!j.ok) { host.innerHTML = `<p class="err">Could not load: ${j.error}</p>`; return; }
  if (which === 'headshot') host.innerHTML = `<img src="${j.url}" style="max-width:100%;border-radius:8px" />`;
  else host.innerHTML = `<video controls src="${j.url}" style="max-width:100%;border-radius:8px"></video>`;
}

document.querySelectorAll('[data-media-preview]').forEach(btn => {
  btn.addEventListener('click', () => {
    const which = btn.getAttribute('data-media-preview');
    previewMedia(id, which);
  });
});

const momoForm = document.getElementById('confirm-payment-form');
momoForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = momoForm.querySelector('button');
  const result = document.getElementById('momo-result');
  button.disabled = true;
  result.textContent = 'Confirming…';
  try {
    const response = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/confirm-payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: document.getElementById('momo-receipt').value,
        receivedAmountGhs: Number(document.getElementById('momo-amount').value),
        confirmed: document.getElementById('momo-confirmed').checked }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok) {
      result.textContent = data.emailSent ? 'Payment confirmed. Application link accepted for email delivery.' : data.emailAlreadySent ? 'Payment confirmed. A link was sent earlier. Reload this page to send a fresh link.' : 'Payment confirmed, but the application email was not sent. Reload this page and use Email application link.';
    } else {
      result.textContent = response.status === 401 ? 'Your admin session expired. Sign in again, then retry.' : `Could not confirm: ${data?.error || 'server error'}. Reload to check payment status before retrying.`;
    }
  } catch { result.textContent = 'Request failed. Retry with the same transaction ID.'; }
  finally { button.disabled = false; }
});

const emailButton = document.getElementById('email-application-link');
emailButton?.addEventListener('click', async () => {
  const result = document.getElementById('email-link-result');
  emailButton.disabled = true;
  result.textContent = 'Sending application link…';
  try {
    const response = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/email-link`, { method: 'POST' });
    const data = await response.json().catch(() => null);
    result.textContent = response.ok && data?.emailSent ? 'Application link accepted for email delivery. Ask the applicant to check her inbox and spam folder.' : `Email not confirmed: ${data?.error || 'server error'}. You can retry without confirming payment again.`;
  } catch { result.textContent = 'The email request could not be confirmed. Check the inbox before retrying.'; }
  finally { emailButton.disabled = false; }
});
