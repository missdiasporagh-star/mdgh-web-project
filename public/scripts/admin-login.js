document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const err = document.getElementById('login-err');
  err.style.display = 'none';
  const res = await fetch('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: f.email.value, password: f.password.value }),
  });
  if (res.ok) window.location.href = '/admin/applications';
  else { err.textContent = 'Invalid email or password.'; err.style.display = 'block'; }
});
