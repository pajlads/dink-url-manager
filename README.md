# DinkPlugin Webhook Filter

A Cloudflare Workers-based webhook filtering proxy for DinkPlugin that allows allowlist/denylist filtering of Discord webhook requests based on user/server IDs.

## Overview

This service acts as a proxy between DinkPlugin and Discord webhooks. It receives webhook payloads, filters them based on configured ID lists, and forwards matching requests to Discord.

## Architecture

- **Runtime**: Cloudflare Workers
- **Framework**: Hono v4
- **Templating**: @hono/jsx
- **Database**: D1 SQLite (raw SQL, no ORM)
- **Build**: Vite + @cloudflare/vite-plugin

### Stack Choice Rationale

Hono provides native multipart form-data parsing (`c.req.parseBody()`), minimal bundle size (~20KB), and first-class D1 integration. A single Worker deployment means no CORS issues and simple ops.

## Installation

### Prerequisites

- Node.js 18+
- pnpm or npm
- Cloudflare account with Workers & D1 enabled
- Wrangler CLI installed (`npm install wrangler -g`)

### Setup Steps

1. **Clone & install dependencies**

```bash
cd webhook-manager
pnpm install
```

2. **Create D1 database**

```bash
wrangler d1 create webhook-filter-db
```

Update `wrangler.toml` with your database ID.

3. **Apply migrations**

```bash
pnpm migrate
```

4. **Development**

```bash
pnpm dev
```

Visit http://localhost:8787

5. **Production build & deploy**

```bash
pnpm build
pnpm deploy
```

## Usage

### Creating a Webhook Filter

1. Visit your deployed worker URL
2. Click "Create New Webhook Filter"
3. You'll be redirected to `/settings/:secret`
4. Copy the webhook URL shown (includes your secret hash)

### Configuration

| Field | Description |
|-------|-------------|
| **Discord Webhook URL** | Your Discord channel's webhook URL |
| **Filter Mode** | `allow` = only IDs in list are forwarded; `deny` = IDs in list are blocked |
| **User/Server IDs** | One Discord user or server ID per line (from `dinkAccountHash` in payload) |

### DinkPlugin Setup

In your DinkPlugin configuration:

```
Webhook URL: https://your-worker.workers.dev/webhook/YOUR_HASH
```

The webhook will automatically filter based on your settings.

## Database Schema

```sql
CREATE TABLE webhook_configs (
  secret_hash TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'allow',
  id_list TEXT  -- JSON object: {"id1": true, "id2": true}
);
```

### Filtering Logic

Filtering is done in SQL using SQLite's `json_extract`:

```sql
SELECT webhook_url FROM webhook_configs
WHERE secret_hash = ?
  AND (
    (mode = 'allow' AND json_extract(id_list, '$.' || ?) IS NOT NULL)
    OR
    (mode = 'deny' AND json_extract(id_list, '$.' || ?) IS NULL)
  )
```

The query returns a row if the user should be forwarded; otherwise returns 0 rows → filtered.

## API Reference

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | Homepage |
| `GET` | `/new` | Create new webhook config |
| `GET` | `/settings/:secret` | Settings form (requires secret in URL) |
| `POST` | `/api/settings` | Update webhook config |
| `POST` | `/webhook/:hash` | Webhook proxy endpoint (DinkPlugin) |

### Webhook Payload

The endpoint accepts:

1. **multipart/form-data** (DinkPlugin with files):
   - `payload_json` (string): JSON payload
   - `file` (optional): Attached file(s)

2. **application/json** (simple notifications):
   - Raw JSON body

**Required payload field**: `dinkAccountHash` (Discord user/server ID)

### Responses

- `200 { status: 'forwarded' }` — Payload sent to Discord
- `200 { status: 'filtered' }` — Payload blocked by filter
- `400 { error: '...' }` — Invalid request (missing fields, bad content-type)
- `404 { error: 'Invalid' }` — Unknown webhook hash
- `502 { error: '...' }` — Discord forwarding failed

## Security

- **Secret handling**: Plaintext secret shown once at creation, never stored. SHA256 hash used for lookup.
- **URL-based auth**: Webhook URL includes hash; settings page requires secret in URL.
- **Input validation**: Discord webhook URLs validated before saving.
- **SQL injection protection**: Parameterized queries for all DB access.

## Troubleshooting

### Migration fails

Ensure `wrangler.toml` has correct `database_id`. Create DB if needed:

```bash
wrangler d1 create webhook-filter-db
```

### Webhook not receiving

Check logs:

```bash
wrangler tail
```

Verify DinkPlugin is sending correct content-type (multipart/form-data or application/json).

### Filtering not working

Ensure `dinkAccountHash` field exists in payload. Test by posting a sample payload:

```bash
curl -X POST https://your-worker.workers.dev/webhook/YOUR_HASH \
  -H "Content-Type: application/json" \
  -d '{"dinkAccountHash":"1234567890"}'
```

Should return `{"status":"filtered"}` if ID not in allowlist.

## Recreating Config

If you lose your secret, you must create a new configuration (secret is never stored). Navigate to `/new` to generate a fresh one and update DinkPlugin.

## License

MIT
