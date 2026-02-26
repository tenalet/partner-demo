(function () {
  const applicationId = qs('applicationId');
  const status = qs('status') || 'unknown';

  document.getElementById('app-id').textContent = applicationId || '-';
  document.getElementById('app-status').innerHTML = statusBadge(status);

  if (applicationId) {
    document.getElementById('reports-link').href =
      '/reports.html?applicationId=' + applicationId;
  } else {
    document.getElementById('reports-link').classList.add('hidden');
  }
})();
