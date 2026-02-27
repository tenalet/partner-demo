(function () {
  const form = document.getElementById('create-form');
  const errorEl = document.getElementById('create-error');
  const listEl = document.getElementById('tolet-list');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function clearError() {
    errorEl.classList.add('hidden');
  }

  // Gate income verification behind credit history
  const creditCheckbox = document.getElementById('mod-credit');
  const incomeCheckbox = document.getElementById('mod-income');

  creditCheckbox.addEventListener('change', () => {
    if (!creditCheckbox.checked) {
      incomeCheckbox.checked = false;
      incomeCheckbox.disabled = true;
    } else {
      incomeCheckbox.disabled = false;
    }
  });

  // Create property
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const modules = Array.from(
      document.querySelectorAll('input[name="modules"]:checked')
    ).map((el) => el.value);

    if (modules.length === 0) {
      showError('Select at least one screening module.');
      return;
    }

    const landlord = {};
    const lFirst = document.getElementById('landlordFirst').value.trim();
    const lLast = document.getElementById('landlordLast').value.trim();
    const lEmail = document.getElementById('landlordEmail').value.trim();
    if (lFirst) landlord.firstName = lFirst;
    if (lLast) landlord.lastName = lLast;
    if (lEmail) landlord.email = lEmail;

    const body = {
      property: {
        address: {
          street: document.getElementById('street').value.trim(),
          unit: document.getElementById('unit').value.trim() || undefined,
          city: document.getElementById('city').value.trim(),
          state: document.getElementById('state').value.trim(),
        },
        role: document.getElementById('role').value,
      },
      requirements: { modules },
      note: document.getElementById('note').value.trim() || undefined,
      isAcceptingApplications: true,
    };

    if (Object.keys(landlord).length > 0) {
      body.property.landlord = landlord;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await api('POST', '/tolets', body);
      form.reset();
      // re-check defaults
      document.querySelector('input[name="modules"][value="rentalApplication"]').checked = true;
      incomeCheckbox.disabled = true;
      await loadTolets();
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Property';
    }
  });

  // Load properties
  async function loadTolets() {
    try {
      const data = await api('GET', '/tolets?limit=50&sort=DESC');
      const items = data.items || data || [];

      if (items.length === 0) {
        listEl.innerHTML = '<div class="empty">No properties yet. Create one to get started.</div>';
        return;
      }

      listEl.innerHTML = items
        .map((t) => {
          const moduleTags = (t.requirements?.modules || [])
            .map((m) => `<span class="badge badge-gray">${m}</span>`)
            .join(' ');

          return `
            <div class="tolet-card" data-id="${t.id}">
              <h3>${escapeHtml(t.displayName || t.id)}</h3>
              <div class="meta">
                Code: ${t.linkCode || '-'} &middot; ${moduleTags}
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
      const items = data.items || data || [];

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
