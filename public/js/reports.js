(function () {
  const applicationId = qs('applicationId');
  const appIdEl = document.getElementById('app-id');
  const listEl = document.getElementById('reports-list');

  appIdEl.textContent = applicationId || '-';

  if (!applicationId) {
    listEl.innerHTML = '<div class="empty">No application ID provided.</div>';
    return;
  }

  async function loadReports() {
    try {
      const reports = await api('GET', `/applications/${applicationId}/reports`);

      if (!reports || reports.length === 0) {
        listEl.innerHTML = '<div class="empty">No reports available yet.</div>';
        return;
      }

      listEl.innerHTML = reports
        .map(
          (r) => `
          <div class="report-card">
            <div class="info">
              <h3>${escapeHtml(r.name)}</h3>
              <p>Type: ${r.type} &middot; Generated: ${formatDate(r.generatedAt)}</p>
            </div>
            <div>
              ${r.available
                ? `<span class="badge badge-green mb-8">available</span>
                   <button class="btn btn-primary btn-sm" onclick="viewReport('${applicationId}', '${r.type}')">View</button>`
                : '<span class="badge badge-yellow">pending</span>'
              }
            </div>
          </div>`
        )
        .join('');
    } catch (err) {
      listEl.innerHTML = `<div class="empty error">${escapeHtml(err.message)}</div>`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  loadReports();
})();

async function viewReport(applicationId, type) {
  try {
    const data = await api('GET', `/applications/${applicationId}/reports/${type}`);
    if (data.url) {
      window.open(data.url, '_blank');
    }
  } catch (err) {
    alert('Failed to get report URL: ' + err.message);
  }
}
