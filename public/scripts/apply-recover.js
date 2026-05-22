document.getElementById('recover-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const msg = document.getElementById('recover-msg');
  msg.style.display = 'block';
  const res = await fetch('/api/applications/recover', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: f.email.value.trim(),
      reference: f.reference.value.trim().toUpperCase(),
      honeypot: f.honeypot.value,
    }),
  });
  const j = await res.json();
  if (j.ok) { msg.className = 'ok'; msg.textContent = "If we found a match, we've emailed you a fresh link."; }
  else if (j.error === 'rate_limited') { msg.className = 'err'; msg.textContent = 'Too many attempts. Try again in an hour.'; }
  else { msg.className = 'err'; msg.textContent = 'Something went wrong. Try again later.'; }
});
