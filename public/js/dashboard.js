(function () {
  const jsonEditor = document.getElementById('create-json');
  const sendBtn = document.getElementById('create-send-btn');
  const errorEl = document.getElementById('create-error');
  const listEl = document.getElementById('tolet-list');

  enableTabInEditor(jsonEditor);

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function clearError() {
    errorEl.classList.add('hidden');
  }

  // Default JSON to reset to after successful creation
  const defaultJson = jsonEditor.value;

  // Create tolet via JSON editor
  sendBtn.addEventListener('click', async () => {
    clearError();

    let body;
    try {
      body = JSON.parse(jsonEditor.value);
    } catch (err) {
      showError('Invalid JSON: ' + err.message);
      return;
    }

    // Validate required fields
    const errors = [];
    // operatorEmail identifies the property operator (landlord/agent) and is
    // keyed on (partner, email, mode) — required by the API.
    if (!body.operatorEmail || typeof body.operatorEmail !== 'string' || !body.operatorEmail.trim()) {
      errors.push('"operatorEmail" is required');
    }
    if (!body.property || typeof body.property !== 'object') {
      errors.push('"property" object is required');
    } else {
      const addr = body.property.address;
      if (!addr || typeof addr !== 'object') {
        errors.push('"property.address" object is required');
      } else {
        if (!addr.street) errors.push('"property.address.street" is required');
        if (!addr.city) errors.push('"property.address.city" is required');
        if (!addr.state) errors.push('"property.address.state" is required');
      }
      const roles = ['landlord', 'tenant_agent', 'listing_agent', 'property_manager'];
      if (!body.property.role) {
        errors.push('"property.role" is required');
      } else if (!roles.includes(body.property.role)) {
        errors.push('"property.role" must be one of: ' + roles.join(', '));
      }
    }
    if (!body.requirements || !Array.isArray(body.requirements.modules) || body.requirements.modules.length === 0) {
      errors.push('"requirements.modules" must be a non-empty array');
    }
    if (body.rent !== undefined) {
      if (typeof body.rent !== 'object' || !body.rent) {
        errors.push('"rent" must be an object with amount and frequency');
      } else {
        if (typeof body.rent.amount !== 'number' || body.rent.amount <= 0) {
          errors.push('"rent.amount" must be a positive number');
        }
        if (body.rent.frequency && !['monthly', 'yearly'].includes(body.rent.frequency)) {
          errors.push('"rent.frequency" must be "monthly" or "yearly"');
        }
      }
    }
    if (errors.length > 0) {
      showError(errors.join('\n'));
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
      await api('POST', '/tolets', body);
      jsonEditor.value = defaultJson;
      await loadTolets();
    } catch (err) {
      showError(err.message);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Request';
    }
  });

  // Load properties
  async function loadTolets() {
    try {
      const data = await api('GET', '/tolets?limit=50');
      // Partner API list envelope: { data: [...], has_more, next_cursor }
      const items = Array.isArray(data) ? data : (data.data || []);

      if (items.length === 0) {
        listEl.innerHTML = '<div class="empty">No properties yet. Create one to get started.</div>';
        return;
      }

      listEl.innerHTML = items
        .map((t) => {
          const moduleTags = (t.requirements?.modules || [])
            .map((m) => `<span class="badge badge-gray">${m}</span>`)
            .join(' ');

          const rentTag = t.rent
            ? `<span class="badge badge-gray">${Number(t.rent.amount).toLocaleString('en-NG')}/${t.rent.frequency || 'yearly'}</span>`
            : '';

          return `
            <div class="tolet-card" data-id="${t.id}">
              <h3>${escapeHtml(t.displayName || t.id)}</h3>
              <div class="meta">
                Code: ${t.linkCode || '-'} &middot; ${moduleTags}
                ${rentTag ? `&middot; ${rentTag}` : ''}
                &middot; ${t.isAcceptingApplications ? '<span class="badge badge-green">active</span>' : '<span class="badge badge-red">closed</span>'}
              </div>
              <div class="actions">
                <a class="btn btn-primary btn-sm" href="/screen.html?toletId=${t.id}">Screen Tenant</a>
                <button class="btn btn-secondary btn-sm toggle-apps-btn" data-tolet-id="${t.id}">Applications</button>
              </div>
              <div class="app-list hidden" id="apps-${t.id}"></div>
            </div>`;
        })
        .join('');

      // Bind toggle buttons
      listEl.querySelectorAll('.toggle-apps-btn').forEach((btn) => {
        btn.addEventListener('click', () => toggleApps(btn.dataset.toletId));
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function toggleApps(toletId) {
    const el = document.getElementById('apps-' + toletId);
    if (!el.classList.contains('hidden')) {
      el.classList.add('hidden');
      return;
    }

    el.classList.remove('hidden');
    el.innerHTML = '<div style="font-size:12px;color:#999;">Loading...</div>';

    try {
      const data = await api('GET', `/tolets/${toletId}/applications?limit=50`);
      // Partner API list envelope: { data: [...], has_more, next_cursor }
      const items = Array.isArray(data) ? data : (data.data || []);

      if (items.length === 0) {
        el.innerHTML = '<div style="font-size:12px;color:#999;">No applications yet.</div>';
        return;
      }

      el.innerHTML = items
        .map(
          (a) => {
            const actionBtn = a.status === 'draft'
              ? `<a class="btn btn-sm btn-primary" href="/screen.html?applicationId=${a.id}&toletId=${toletId}">Resume</a>`
              : `<a class="btn btn-sm btn-secondary" href="/reports.html?applicationId=${a.id}">Reports</a>`;
            return `
          <div class="app-item">
            <span>${escapeHtml(a.applicantFullName || '-')} ${statusBadge(a.status)}</span>
            ${actionBtn}
          </div>`;
          }
        )
        .join('');
    } catch (err) {
      el.innerHTML = `<div style="font-size:12px;" class="error">${escapeHtml(err.message)}</div>`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  loadTolets();
})();
