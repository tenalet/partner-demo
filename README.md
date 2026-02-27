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

## API Reference

All endpoints require the `X-API-Key` header with your partner API key. The base URL defaults to `https://api.tenalet.com/v1/partner`.

### Tolets (Properties)

#### `POST /tolets`

Create a property listing for tenant screening.

**Request body:**

```json
{
  "property": {
    "address": "12 Adeola Odeku St, Victoria Island, Lagos",
    "city": "Lagos",
    "state": "Lagos",
    "type": "apartment"
  },
  "requirements": {
    "modules": ["rentalApplication", "incomeVerification", "creditHistoryAndScore"]
  },
  "note": "2-bedroom flat, 3rd floor",
  "isAcceptingApplications": true
}
```

Available modules: `rentalApplication`, `incomeVerification`, `creditHistoryAndScore`. Note: `incomeVerification` requires `creditHistoryAndScore` to also be selected.

#### `GET /tolets`

List your tolets (paginated). Query params: `page`, `limit`, `sort` (`ASC`/`DESC`).

#### `GET /tolets/:id`

Get a single tolet's details.

#### `PATCH /tolets/:id`

Update a tolet (partial update).

### Applications

#### `POST /tolets/:toletId/applications`

Create a screening application and get embed credentials. This is the main endpoint for the embed flow.

**Request body:**

```json
{
  "externalUserId": "usr_abc123",
  "firstName": "Kemi",
  "lastName": "Adebayo",
  "phone": "+2348012345678"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `externalUserId` | Yes | Your unique ID for the applicant (alphanumeric, dots, hyphens, underscores) |
| `firstName` | No | Pre-fills the application form |
| `lastName` | No | Pre-fills the application form |
| `phone` | No | Pre-fills the application form |

**Response:**

```json
{
  "applicationId": "uuid",
  "token": "eyJhbG...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "eyJhbG...",
  "refreshExpiresIn": 604800,
  "embedUrl": "https://app.tenalet.com/embed/apply/uuid"
}
```

| Field | Description |
|-------|-------------|
| `applicationId` | UUID of the created application |
| `token` | Short-lived JWT access token for the embed iframe |
| `tokenType` | Always `Bearer` |
| `expiresIn` | Access token lifetime in seconds |
| `refreshToken` | Long-lived refresh token for silent renewal |
| `refreshExpiresIn` | Refresh token lifetime in seconds |
| `embedUrl` | Full URL to load in the embed iframe |

The `refreshToken` is used by the SDK to silently renew the session when the access token expires. Partners must pass both `token` and `refreshToken` to the SDK (see [Embed SDK](#embed-sdk) below).

#### `POST /applications/:id/embed-token`

Generate fresh embed tokens for an existing **draft** application. Use this to resume an application that was started but not yet submitted. Returns the same response shape as the create endpoint.

Returns `400` if the application has already been submitted.

#### `GET /tolets/:toletId/applications`

List applications for a tolet (paginated).

#### `GET /applications/:id`

Get a single application's details (status, timestamps, applicant info).

### Reports

#### `GET /applications/:id/reports`

List available screening reports for a completed application.

#### `GET /applications/:id/reports/:type`

Get an ephemeral URL (60s expiry) to download a report. Types: `income`, `credit`, `application`, `full`.

## Embed SDK

The SDK (`embed.js`) renders the Tenalet screening form inside an iframe on your page. Load it from Tenalet's app URL:

```html
<script src="https://app.tenalet.com/embed.js"></script>
<div id="tenalet-app"></div>
```

### `Tenalet.startApplication(options)` (Partner embed flow)

Use this after creating an application via the API. The applicant is pre-authenticated — no sign-in step required.

```js
const embed = Tenalet.startApplication({
  applicationId: response.applicationId,
  token: response.token,
  refreshToken: response.refreshToken,
  containerId: 'tenalet-app',
  baseUrl: 'https://app.tenalet.com',       // optional, defaults to production
  redirectUrl: '/success.html',              // optional, redirect after submission
  onLoaded: function () { },                 // embed iframe loaded
  onAuthenticated: function (data) { },      // token accepted
  onApplicationStarted: function (data) { }, // applicant began filling form
  onApplicationSubmitted: function (data) { }, // screening submitted
  onError: function (data) { },              // something went wrong
});

// To remove the embed later:
embed.destroy();
```

| Option | Required | Description |
|--------|----------|-------------|
| `applicationId` | Yes | From the API response |
| `token` | Yes | Access token from the API response |
| `refreshToken` | No | Refresh token from the API response. Enables silent token renewal so the session survives past the access token expiry. |
| `containerId` | No | DOM element ID to render into (default: `tenalet-app`) |
| `baseUrl` | No | Tenalet app URL (default: `https://app.tenalet.com`) |
| `redirectUrl` | No | URL to redirect to after submission. `applicationId` and `status` are appended as query params. |
| `onLoaded` | No | Called when the iframe content has loaded |
| `onAuthenticated` | No | Called when the token is accepted and the user is authenticated |
| `onApplicationStarted` | No | Called when the applicant begins filling the form |
| `onApplicationSubmitted` | No | Called when the applicant submits the screening |
| `onError` | No | Called on errors (e.g. invalid token, network failure) |

### `Tenalet.createApplication(options)` (Link-code flow)

Use this for the self-service flow where applicants sign in with OTP. No API call needed — just a link code from the dashboard.

```js
const embed = Tenalet.createApplication({
  linkCode: 'abc123',
  containerId: 'tenalet-app',
  onApplicationSubmitted: function (data) { },
});
```

### Token lifecycle

The access token (`token`) is short-lived. When it expires, the embed SDK automatically uses the `refreshToken` to obtain a new access token without interrupting the applicant. If no `refreshToken` is provided, the session will end when the access token expires and the applicant will see an error.

Always pass `refreshToken` from the API response to `startApplication()`.

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
