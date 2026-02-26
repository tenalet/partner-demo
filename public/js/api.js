async function api(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch('/api' + path, options);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

async function getConfig() {
  return api('GET', '/config');
}

function qs(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function statusBadge(status) {
  const map = {
    draft: 'badge-yellow',
    submitted: 'badge-green',
    approved: 'badge-green',
    rejected: 'badge-red',
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status}</span>`;
}
