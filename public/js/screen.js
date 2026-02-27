(function () {
  const toletId = qs('toletId');
  const applicationId = qs('applicationId');

  if (!toletId && !applicationId) {
    alert('Missing toletId or applicationId query parameter');
    window.location.href = '/';
    return;
  }

  const formCard = document.getElementById('tenant-form-card');
  const embedCard = document.getElementById('embed-card');
  const form = document.getElementById('tenant-form');
  const errorEl = document.getElementById('screen-error');
  const logEl = document.getElementById('event-log');
  const toletNameEl = document.getElementById('tolet-name');

  // Load tolet name
  if (toletId) {
    api('GET', '/tolets/' + toletId)
      .then((t) => {
        toletNameEl.textContent = t.displayName || t.id;
      })
      .catch(() => {
        toletNameEl.textContent = toletId;
      });
  }

  // Resume flow: if applicationId is provided, skip the form and load embed directly
  if (applicationId) {
    formCard.classList.add('hidden');
    embedCard.classList.remove('hidden');
    toletNameEl.textContent = 'Resuming application...';

    api('POST', '/applications/' + applicationId + '/embed-token')
      .then((result) => {
        logEvent('api:application_resumed', {
          applicationId: result.applicationId,
          expiresIn: result.expiresIn,
          refreshExpiresIn: result.refreshExpiresIn,
        });
        toletNameEl.textContent = 'Application ' + result.applicationId.substring(0, 8) + '...';
        loadEmbed(result);
      })
      .catch((err) => {
        embedCard.classList.add('hidden');
        formCard.classList.remove('hidden');
        showError('Failed to resume: ' + err.message);
      });
  }

  function logEvent(type, data) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB');
    const dataStr = data ? ' ' + JSON.stringify(data) : '';

    const entry = document.createElement('div');
    entry.className = 'entry';
    entry.innerHTML =
      '<span class="time">[' + time + ']</span> <span class="type">' + escapeHtml(type) + '</span>' + escapeHtml(dataStr);

    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Submit tenant form → create application → load embed
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const body = {
      externalUserId: document.getElementById('externalUserId').value.trim(),
      firstName: document.getElementById('firstName').value.trim() || undefined,
      lastName: document.getElementById('lastName').value.trim() || undefined,
      phone: document.getElementById('phone').value.trim() || undefined,
    };

    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = 'Creating application...';

    try {
      const result = await api('POST', `/tolets/${toletId}/applications`, body);
      logEvent('api:application_created', {
        applicationId: result.applicationId,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        refreshExpiresIn: result.refreshExpiresIn,
      });

      // Hide form, show embed
      formCard.classList.add('hidden');
      embedCard.classList.remove('hidden');

      // Load embed SDK and start
      await loadEmbed(result);
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Start Screening';
    }
  });

  async function loadEmbed(appData) {
    const config = await getConfig();
    const appUrl = config.appUrl;

    logEvent('sdk:loading', { baseUrl: appUrl });

    // Dynamically load embed.js
    const script = document.createElement('script');
    script.src = appUrl + '/embed.js';
    script.onload = () => {
      logEvent('sdk:script_loaded', null);

      if (!window.Tenalet) {
        logEvent('sdk:error', { message: 'Tenalet global not found' });
        return;
      }

      // Listen for ALL postMessage events from the iframe
      window.addEventListener('message', (event) => {
        if (!event.data || !event.data.type) return;
        // Only log tenalet events
        if (typeof event.data.type === 'string' && event.data.type.startsWith('tenalet:')) {
          logEvent('postMessage:' + event.data.type, event.data);
        }
      });

      const redirectUrl = window.location.origin + '/success.html';

      const embed = window.Tenalet.startApplication({
        applicationId: appData.applicationId,
        token: appData.token,
        refreshToken: appData.refreshToken,
        containerId: 'tenalet-app',
        baseUrl: appUrl,
        redirectUrl: redirectUrl,
        onLoaded: () => logEvent('callback:onLoaded', null),
        onAuthenticated: (data) => logEvent('callback:onAuthenticated', data),
        onApplicationStarted: (data) => logEvent('callback:onApplicationStarted', data),
        onApplicationSubmitted: (data) => logEvent('callback:onApplicationSubmitted', data),
        onError: (data) => logEvent('callback:onError', data),
      });

      logEvent('sdk:startApplication_called', {
        applicationId: appData.applicationId,
        redirectUrl,
      });
    };

    script.onerror = () => {
      logEvent('sdk:error', { message: 'Failed to load embed.js from ' + appUrl });
    };

    document.head.appendChild(script);
  }
})();
