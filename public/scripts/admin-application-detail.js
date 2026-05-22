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
