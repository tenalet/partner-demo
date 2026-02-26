# Tenalet Partner Demo

Reference implementation and testing environment for the Tenalet Partner SDK. Demonstrates property creation, embedded tenant screening, report access, and webhook handling.

## Quick Start

**Prerequisites:** Node.js 18+ (uses native `fetch`)

```bash
git clone https://github.com/tenalet/partner-demo.git
cd partner-demo
npm install
cp .env.example .env
# Edit .env with your partner API key
npm start
```

Open [http://localhost:3500](http://localhost:3500) in your browser.

## How It Works

```
Browser (public/)              Express Server (server.js)              Tenalet API
┌─────────────────┐           ┌──────────────────────────┐           ┌─────────────┐
│  Static HTML/JS  │──/api/*──▶  Proxy (adds API key)    │──────────▶│  api.tenalet │
│                  │◀─────────│                          │◀──────────│  .com        │
│  embed.js loaded │          │  /api/webhooks/tenalet   │◀──webhook─│             │
│  from app URL    │          │  (signature verification) │           └─────────────┘
└─────────────────┘           └──────────────────────────┘
```

- **Express server** (`server.js`) proxies `/api/*` requests to the Tenalet API, injecting your API key server-side so it's never exposed to the browser.
- **Static frontend** (`public/`) calls the local proxy using relative paths.
- **Webhook endpoint** at `/api/webhooks/tenalet` receives events with HMAC-SHA256 signature verification and stores them in memory.
- **Embed SDK** (`embed.js`) is loaded dynamically from Tenalet's app URL to render the screening form in an iframe.

## Pages

### Dashboard (`/`)

Create properties (tolets), view your properties list, and expand each to see its applications.

### Screen Tenant (`/screen.html?toletId=...`)

Creates an application via the API, loads the Tenalet embed iframe for the applicant to complete screening, and shows a live event log sidebar.

### Reports (`/reports.html?applicationId=...`)

View and download screening reports. Report URLs are ephemeral and generated on demand.

### Success (`/success.html`)

Redirect landing page after an applicant completes their screening submission.

### Webhooks (`/webhooks.html`)

Real-time webhook event viewer showing all received events with their signature verification status.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TENALET_API_URL` | Tenalet API base URL | `https://api.tenalet.com` |
| `TENALET_APP_URL` | Tenalet app URL (serves `embed.js`) | `https://app.tenalet.com` |
| `TENALET_API_KEY` | Your partner API key | — |
| `TENALET_WEBHOOK_SECRET` | Webhook signature secret | — |
| `PORT` | Local server port | `3500` |

For local development against a local Tenalet instance, override the URLs:

```bash
TENALET_API_URL=http://localhost:3000
TENALET_APP_URL=http://localhost:3001
```

## Webhook Testing

The demo server receives webhooks at `POST /api/webhooks/tenalet`. To test locally:

1. Set `TENALET_WEBHOOK_SECRET` in your `.env` to match your partner account's configured secret.
2. Use a tunnel service (e.g., ngrok) to expose your local server:
   ```bash
   ngrok http 3500
   ```
3. Configure the tunnel URL as your webhook endpoint in the Tenalet admin dashboard:
   ```
   https://your-tunnel.ngrok.io/api/webhooks/tenalet
   ```
4. Open [http://localhost:3500/webhooks.html](http://localhost:3500/webhooks.html) to see incoming events.

## Project Structure

```
partner-demo/
├── server.js              # Express server: API proxy, webhook handler, config endpoint
├── public/
│   ├── index.html         # Dashboard page
│   ├── screen.html        # Tenant screening page
│   ├── reports.html       # Reports viewer
│   ├── success.html       # Post-submission redirect
│   ├── webhooks.html      # Webhook event viewer
│   ├── css/               # Styles
│   └── js/
│       ├── api.js         # Shared API client (calls local proxy)
│       ├── dashboard.js   # Dashboard logic
│       ├── screen.js      # Screening + embed logic
│       ├── reports.js     # Report fetching/display
│       ├── success.js     # Success page logic
│       └── webhooks.js    # Webhook polling/display
├── .env.example           # Environment template
├── package.json
├── LICENSE
└── README.md
```

## License

[MIT](LICENSE)
