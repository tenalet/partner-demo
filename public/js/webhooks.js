(function () {
  const container = document.getElementById('webhooks-container');
  const autoRefreshEl = document.getElementById('auto-refresh');
  let intervalId = null;

  function signatureBadge(valid) {
    if (valid === true) return '<span class="badge badge-green">valid</span>';
    if (valid === false) return '<span class="badge badge-red">invalid</span>';
    return '<span class="badge badge-yellow">no secret</span>';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadWebhooks() {
    try {
      const events = await api('GET', '/webhooks');

      if (!events || events.length === 0) {
        container.innerHTML = '<div class="empty">No webhook events received yet.</div>';
        return;
      }

      container.innerHTML = `
        <table class="webhook-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Event</th>
              <th>Signature</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            ${events
              .map(
                (e) => `
              <tr>
                <td>${formatDate(e.receivedAt)}</td>
                <td><strong>${escapeHtml(e.event)}</strong></td>
                <td>${signatureBadge(e.signatureValid)}</td>
                <td class="payload"><pre>${escapeHtml(JSON.stringify(e.data, null, 2))}</pre></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    } catch (err) {
      container.innerHTML = `<div class="empty error">${escapeHtml(err.message)}</div>`;
    }
  }

  function startPolling() {
    loadWebhooks();
    intervalId = setInterval(loadWebhooks, 3000);
  }

  function stopPolling() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  autoRefreshEl.addEventListener('change', () => {
    if (autoRefreshEl.checked) {
      startPolling();
    } else {
      stopPolling();
    }
  });

  startPolling();
})();
