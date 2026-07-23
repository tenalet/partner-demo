(function () {
  const toletId = qs('toletId');
  const applicationId = qs('applicationId');

  if (!toletId && !applicationId) {
    alert('Missing toletId or applicationId query parameter');
    window.location.href = '/';
    return;
  }

  const formCard = document.getElementById('tenant-form-card');
  const embedView = document.getElementById('embed-view');
  const jsonEditor = document.getElementById('app-json');
  const sendBtn = document.getElementById('start-btn');
  const errorEl = document.getElementById('screen-error');
  const logEl = document.getElementById('event-log');
  const toletNameEl = document.getElementById('tolet-name');
  const endpointPathEl = document.getElementById('app-endpoint-path');

  enableTabInEditor(jsonEditor);

  // Drawer elements
  const logDrawer = document.getElementById('log-drawer');
  const logOverlay = document.getElementById('log-overlay');
  const logToggleBtn = document.getElementById('log-toggle');
  const logCloseBtn = document.getElementById('log-drawer-close');
  const logBadge = document.getElementById('log-badge');

  // Size picker elements
  const sizeButtons = document.querySelectorAll('.size-btn');
  const embedWrapper = document.getElementById('screenkit-embed-wrapper');

  // Drawer state
  var drawerOpen = false;
  var unseenCount = 0;

  function openDrawer() {
    drawerOpen = true;
    logDrawer.classList.add('open');
    logOverlay.classList.remove('hidden');
    unseenCount = 0;
    logBadge.classList.add('hidden');
    logBadge.textContent = '0';
  }

  function closeDrawer() {
    drawerOpen = false;
    logDrawer.classList.remove('open');
    logOverlay.classList.add('hidden');
  }

  function toggleDrawer() {
    if (drawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  logToggleBtn.addEventListener('click', toggleDrawer);
  logCloseBtn.addEventListener('click', closeDrawer);
  logOverlay.addEventListener('click', closeDrawer);

  // Size picker
  sizeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      sizeButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var size = btn.getAttribute('data-size');
      if (size === '100%') {
        embedWrapper.style.maxWidth = '100%';
      } else {
        embedWrapper.style.maxWidth = size + 'px';
      }
    });
  });

  // Show embed view (hide form, show toolbar + embed)
  function showEmbedView() {
    formCard.classList.add('hidden');
    embedView.classList.remove('hidden');
  }

  // Update dynamic endpoint path
  if (toletId) {
    endpointPathEl.textContent = '/tolets/' + toletId + '/applications';
  }

  // Load tolet name
  if (toletId) {
    api('GET', '/tolets/' + toletId)
      .then(function (t) {
        toletNameEl.textContent = t.displayName || t.id;
      })
      .catch(function () {
        toletNameEl.textContent = toletId;
      });
  }

  // Resume flow: if applicationId is provided, skip the form and load embed directly
  if (applicationId) {
    showEmbedView();
    toletNameEl.textContent = 'Resuming application...';

    api('POST', '/applications/' + applicationId + '/embed-token')
      .then(function (result) {
        logEvent('api:application_resumed', {
          applicationId: result.applicationId,
          expiresIn: result.expiresIn,
          refreshExpiresIn: result.refreshExpiresIn,
        });
        toletNameEl.textContent = 'Application ' + result.applicationId.substring(0, 8) + '...';
        loadEmbed(result);
      })
      .catch(function (err) {
        embedView.classList.add('hidden');
        formCard.classList.remove('hidden');
        showError('Failed to resume: ' + err.message);
      });
  }

  function logEvent(type, data) {
    var now = new Date();
    var time = now.toLocaleTimeString('en-GB');
    var dataStr = data ? ' ' + JSON.stringify(data) : '';

    var entry = document.createElement('div');
    entry.className = 'entry';
    entry.innerHTML =
      '<span class="time">[' + time + ']</span> <span class="type">' + escapeHtml(type) + '</span>' + escapeHtml(dataStr);

    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;

    // Update badge if drawer is closed
    if (!drawerOpen) {
      unseenCount++;
      logBadge.textContent = unseenCount > 99 ? '99+' : unseenCount;
      logBadge.classList.remove('hidden');
    }
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Submit JSON → create application → load embed
  sendBtn.addEventListener('click', async function () {
    errorEl.classList.add('hidden');

    var body;
    try {
      body = JSON.parse(jsonEditor.value);
    } catch (err) {
      showError('Invalid JSON: ' + err.message);
      return;
    }

    // Validate required fields. Applications are keyed on the applicant email
    // (partner, email, mode) — re-sending the same email returns the existing draft.
    if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
      showError('"email" is required');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
      var result = await api('POST', '/tolets/' + toletId + '/applications', body);
      logEvent('api:application_created', {
        applicationId: result.applicationId,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        refreshExpiresIn: result.refreshExpiresIn,
      });

      // Hide form, show embed view
      showEmbedView();

      // Load embed SDK and start
      await loadEmbed(result);
    } catch (err) {
      showError(err.message);
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Request';
    }
  });

  async function loadEmbed(appData) {
    var config = await getConfig();
    var appUrl = config.appUrl;

    logEvent('sdk:loading', { baseUrl: appUrl });

    // Dynamically load embed.js
    var script = document.createElement('script');
    script.src = appUrl + '/embed.js';
    script.onload = function () {
      logEvent('sdk:script_loaded', null);

      if (!window.ScreenKit) {
        logEvent('sdk:error', { message: 'ScreenKit global not found' });
        return;
      }

      // Listen for ALL postMessage events from the iframe
      window.addEventListener('message', function (event) {
        if (!event.data || !event.data.type) return;
        // Only log screenkit events
        if (typeof event.data.type === 'string' && event.data.type.startsWith('screenkit:')) {
          logEvent('postMessage:' + event.data.type, event.data);
        }
      });

      var redirectUrl = window.location.origin + '/success.html';

      var embed = window.ScreenKit.startApplication({
        applicationId: appData.applicationId,
        token: appData.token,
        refreshToken: appData.refreshToken,
        containerId: 'screenkit-app',
        redirectUrl: redirectUrl,
        onLoaded: function () { logEvent('callback:onLoaded', null); },
        onAuthenticated: function (data) { logEvent('callback:onAuthenticated', data); },
        onApplicationStarted: function (data) { logEvent('callback:onApplicationStarted', data); },
        onApplicationSubmitted: function (data) { logEvent('callback:onApplicationSubmitted', data); },
        onError: function (data) { logEvent('callback:onError', data); },
      });

      logEvent('sdk:startApplication_called', {
        applicationId: appData.applicationId,
        redirectUrl: redirectUrl,
      });
    };

    script.onerror = function () {
      logEvent('sdk:error', { message: 'Failed to load embed.js from ' + appUrl });
    };

    document.head.appendChild(script);
  }
})();
