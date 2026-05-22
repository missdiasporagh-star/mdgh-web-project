document.getElementById('notify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('notify-email').value.trim();
  const msg = document.getElementById('notify-msg');
  msg.style.display = 'block';
  const res = await fetch('/api/notifications/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'cycle_closed', disqualifyingRule: null, honeypot: '' }),
  });
  if (res.ok) { msg.className = 'ok'; msg.textContent = "You're on the list."; }
  else { msg.className = 'err'; msg.textContent = 'Something went wrong.'; }
});
