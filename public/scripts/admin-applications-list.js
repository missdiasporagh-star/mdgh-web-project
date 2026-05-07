document.getElementById('logout-form').addEventListener('submit', (e) => {
  e.preventDefault();
  fetch('/api/admin/logout', { method: 'POST' }).then(() => {
    window.location.href = '/admin/login';
  });
});
