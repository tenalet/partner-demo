require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();

const API_URL = process.env.TENALET_API_URL || 'http://localhost:3000';
const APP_URL = process.env.TENALET_APP_URL || 'http://localhost:3001';
const API_KEY = process.env.TENALET_API_KEY || '';
const WEBHOOK_SECRET = process.env.TENALET_WEBHOOK_SECRET || '';
const PORT = parseInt(process.env.PORT || '3500', 10);

// --- In-memory webhook store ---
const webhookEvents = [];
const MAX_WEBHOOK_EVENTS = 100;

// --- Middleware ---

// Parse JSON for all routes except webhooks (handled separately for raw body)
app.use((req, res, next) => {
  if (req.path === '/api/webhooks/tenalet') return next();
  express.json()(req, res, next);
});

// Webhook route needs raw body for signature verification
app.post('/api/webhooks/tenalet', express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}), (req, res) => {
  const signature = req.headers['x-tenalet-signature'];
  const event = req.headers['x-tenalet-event'] || req.body?.event;

  let signatureValid = null;
  if (WEBHOOK_SECRET && signature) {
    try {
      const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(req.rawBody, 'utf8')
        .digest('hex');

      signatureValid = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      signatureValid = false;
    }
  }

  const entry = {
    id: crypto.randomUUID(),
    event: event || 'unknown',
    data: req.body?.data || req.body,
    timestamp: req.body?.timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    signatureValid,
  };

  webhookEvents.unshift(entry);
  if (webhookEvents.length > MAX_WEBHOOK_EVENTS) {
    webhookEvents.length = MAX_WEBHOOK_EVENTS;
  }

  console.log(`[webhook] ${entry.event} received (signature: ${signatureValid})`);
  res.status(200).json({ received: true });
});

// Return stored webhook events
app.get('/api/webhooks', (_req, res) => {
  res.json(webhookEvents);
});

// --- Config endpoint ---
app.get('/api/config', (_req, res) => {
  res.json({ appUrl: APP_URL });
});

// --- Generic proxy helper ---
async function proxyToTenalet(method, apiPath, body) {
  const url = `${API_URL}/api/v1/partner${apiPath}`;
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  };

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  } catch (err) {
    console.error(`[proxy] ${method} ${url} failed:`, err.message);
    return { status: 502, data: { error: 'Bad Gateway', message: err.message } };
  }
}

// --- Proxy routes ---

// Tolets
app.post('/api/tolets', async (req, res) => {
  const result = await proxyToTenalet('POST', '/tolets', req.body);
  res.status(result.status).json(result.data);
});

app.get('/api/tolets', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const path = '/tolets' + (qs ? `?${qs}` : '');
  const result = await proxyToTenalet('GET', path);
  res.status(result.status).json(result.data);
});

app.get('/api/tolets/:id', async (req, res) => {
  const result = await proxyToTenalet('GET', `/tolets/${req.params.id}`);
  res.status(result.status).json(result.data);
});

// Applications
app.post('/api/tolets/:toletId/applications', async (req, res) => {
  const result = await proxyToTenalet('POST', `/tolets/${req.params.toletId}/applications`, req.body);
  res.status(result.status).json(result.data);
});

app.get('/api/tolets/:toletId/applications', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const apiPath = `/tolets/${req.params.toletId}/applications` + (qs ? `?${qs}` : '');
  const result = await proxyToTenalet('GET', apiPath);
  res.status(result.status).json(result.data);
});

app.get('/api/applications/:id', async (req, res) => {
  const result = await proxyToTenalet('GET', `/applications/${req.params.id}`);
  res.status(result.status).json(result.data);
});

// Reports
app.get('/api/applications/:id/reports', async (req, res) => {
  const result = await proxyToTenalet('GET', `/applications/${req.params.id}/reports`);
  res.status(result.status).json(result.data);
});

app.get('/api/applications/:id/reports/:type', async (req, res) => {
  const result = await proxyToTenalet('GET', `/applications/${req.params.id}/reports/${req.params.type}`);
  res.status(result.status).json(result.data);
});

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Start ---
app.listen(PORT, () => {
  console.log(`Partner demo running at http://localhost:${PORT}`);
  console.log(`  API proxy → ${API_URL}`);
  console.log(`  App URL   → ${APP_URL}`);
});
