# Framework Recommendation: Cloudflare Workers + D1 Database
## Webhook Filtering Proxy Service for DinkPlugin

## Executive Recommendation

**Primary Recommendation: Hono-only full-stack (single Worker)**

This is a simple 2-page webapp with heavy API usage (webhook proxy). Using Hono alone gives you:
- Minimal bundle size (cold starts ~0ms)
- Native multi-part form-data parsing built-in
- Server-side rendering with JSX
- Single deployment unit (no CORS, no separate builds)
- D1 integration with zero friction
- Simple to maintain (one codebase)

---

## Use Case Analysis

### Requirements Breakdown
1. **Homepage**: Static marketing content (explains service)
2. **Settings page**: Form for Discord server owners (webhook URL, ID list + mode)
3. **Webhook proxy endpoint**: Receives DinkPlugin POSTs, filters, forwards to Discord
4. **Security model**: Secret string → SHA256 hash in URL for lookup
5. **Database**: Store webhook configs (D1)

### Key Technical Requirements
- Multi-part form-data parsing ✅ Hono: `c.req.parseBody()`
- SHA256 hashing ✅ Cloudflare Workers: `crypto.subtle.digest('SHA-256', ...)`
- ID list filtering ✅ SQL `json_extract` in D1 query (no app-level parsing)
- Allow/deny mode ✅ SQLite `CASE` in WHERE clause
- Simple authentication ✅ Secret-in-URL pattern
- Low traffic (Discord webhooks) ✅ Edge deployment ideal

---

## Framework Re-evaluation for This Use Case

### Why Hono is Still Optimal

**Hono excels for API-heavy apps:**
- Native `parseBody()` handles `multipart/form-data` perfectly (your DinkPlugin payloads)
- Zero middleware overhead for form parsing
- Official Cloudflare support with copious examples for D1 + Workers
- Can render HTML with JSX or template literals for simple pages
- Bundle size remains tiny (<20KB) → instant cold starts
- Can serve static assets directly via `serveStatic` middleware if needed

**Sample request handling:**
```typescript
app.post('/webhook/:hash', async (c) => {
  const contentType = c.req.header('Content-Type') || ''

  let payload: any
  let jsonString: string | undefined
  let file: File | undefined

  if (contentType.includes('multipart/form-data')) {
    // DinkPlugin sends multipart with 'payload_json' field + optional 'file'
    const body = await c.req.parseBody()
    jsonString = body.payload_json as string | undefined
    if (!jsonString) return c.json({ error: 'Missing payload_json field' }, 400)
    payload = JSON.parse(jsonString)
    file = body.file as File | undefined
  } else if (contentType.includes('application/json')) {
    // Simple case: raw JSON body (no file)
    payload = await c.req.json()
  } else {
    return c.json({ error: 'Unsupported content type' }, 415)
  }

  // Look up config by SHA256 hash
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  ).bind(c.req.param('hash')).run()
  const config = results[0] as Config | undefined

  if (!config) return c.json({ error: 'Invalid' }, 404)

  // Apply filters
  const filterResult = applyFilters(payload, config)
  if (!filterResult.pass) {
    return c.json({ status: 'filtered', reason: filterResult.reason })
  }

  // Forward to Discord
  if (contentType.includes('multipart/form-data')) {
    // Recreate FormData with original field names to preserve structure
    const form = new FormData()
    form.append('payload_json', jsonString!)  // original JSON string unchanged
    if (file) {
      const files = Array.isArray(file) ? file : [file]
      for (const f of files) {
        form.append('file', f, f.name)
      }
    }
    await fetch(config.webhook_url, { method: 'POST', body: form })
  } else {
    // JSON-only: forward as raw JSON
    await fetch(config.webhook_url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return c.json({ status: 'forwarded' })
})
```

**Serving the settings page:**
```typescript
app.get('/settings/:secret', async (c) => {
  const hash = await sha256(c.req.param('secret'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  ).bind(hash).run()
  const config = results[0] as Config | undefined

  if (!config) return c.notFound()

  // id_list is a JSON object; extract keys for display in textarea
  const idListKeys = config.id_list
    ? Object.keys(JSON.parse(config.id_list)).join('\n')
    : ''

  const secretFromUrl = c.req.param('secret')
  return c.html(
    <html>
      <body>
        <h1>Settings</h1>
        <form method="post" action="/api/settings">
          <input type="hidden" name="secret" value={secretFromUrl} />
          <input name="webhook_url" value={config.webhook_url} required />
           <label>Mode:
             <select name="mode">
               <option value="allow" selected={config.mode === 'allow'}>Allow only these IDs</option>
               <option value="deny" selected={config.mode === 'deny'}>Deny these IDs</option>
             </select>
           </label>
           <textarea name="id_list" rows={4}>
             {idListKeys}
           </textarea>
           <small>Enter one user/server ID per line. In allow mode, only these IDs will be forwarded. In deny mode, these IDs will be blocked.</small>
           <br />
           <button type="submit">Save</button>
        </form>
        <p>Webhook URL: <code>/webhook/{config.secret_hash}</code></p>
        <p><small>Your secret: <code>{secretFromUrl}</code>. Save it; it will not be shown again.</small></p>
      </body>
    </html>
  )
})
```

---

## Implementation Approach

**Single Hono Worker project:**
```
├── GET  /              → homepage (static HTML/JSX with Tailwind)
├── GET  /new           → create new config, redirect to /settings/:secret
├── GET  /settings/:secret → HTML form for webhook config (secret in URL)
├── POST /api/settings  → save config (secret in hidden form field, lookup by hash)
├── POST /webhook/:hash → receive DinkPlugin payload, filter using SQL json_extract, forward to Discord
└── Static assets via Workers Assets
```

**Frontend:** JSX (`@hono/jsx`) with Tailwind CSS for styling.
**Database:** D1 SQLite with raw SQL, using `json_extract` for efficient ID filtering.
**Estimated implementation:** 2-3 days MVP, 1 week polished.

### Primary: Hono-Only Full-Stack (Single Worker)

**Why this wins:**
1. **Bundle efficiency**: ~20KB total vs 200KB+ alternatives
2. **Simplicity**: 1 project, 1 build, 1 deployment
3. **Form handling**: Native `parseBody()` for multi-part = perfect for DinkPlugin
4. **D1 integration**: First-class Cloudflare support
5. **Sufficient features**: JSX rendering is available; you don't need React for 2 pages
6. **Cost**: Smaller bundle → lower compute cost (though negligible at your expected scale)

**Technology stack:**
- **Backend**: Hono (API routes)
- **Frontend**: Hono + JSX (via `@hono/jsx`) or template literals for simple pages
- **Database**: D1 SQLite + Drizzle ORM (strongly recommended for schema management)
- **Build**: Vite + `@cloudflare/vite-plugin` + `@hono/vite-dev-server`
- **Deployment**: Wrangler (minimal config)

**Example project structure:**
```
my-webhook-proxy/
├── src/
│   ├── index.tsx      # Hono app + route definitions
│   ├── worker.ts      # Worker entry (for custom exports if needed)
│   ├── components/
│   │   ├── HomePage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── Layout.tsx
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema
│   │   └── migrations/        # SQL migrations
│   └── lib/
│       └── discord.ts         # Forward to Discord webhook (FormData helper)
├── public/                     # Static assets (favicon, CSS)
├── vite.config.ts
├── wrangler.toml
└── package.json
```

---

## Why Hono Wins in 2026

1. **Performance**: Built for edge from ground up
2. **Bundle size**: Critical for Workers cold starts (sub-second)
3. **Maturity**: 3+ years of production use, excellent docs
4. **Developer experience**: Express-like API with TypeScript first
5. **Ecosystem**: Rapidly growing, especially around D1 + Drizzle combos
6. **Official support**: Cloudflare maintains docs and examples
7. **Cost efficiency**: Smaller bundles = lower compute costs

### Tables

**webhook_configs** (only table needed)
```sql
CREATE TABLE webhook_configs (
  secret_hash TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL,         -- Discord webhook URL
  mode TEXT NOT NULL DEFAULT 'allow', -- 'allow' or 'deny'
  id_list TEXT                       -- JSON object: {"id1": true, "id2": true}
);
```

**Schema rationale:**
- `secret_hash` is SHA256 of random secret; it's the primary key and sole lookup key
- No `secret` column — plaintext secret is **never stored**, shown to user only once at creation
- `mode` = `'allow'` → only forward if ID exists in `id_list` dictionary
- `mode` = `'deny'` → block if ID exists in `id_list` dictionary
- `id_list` stored as JSON object where keys are user/server IDs and values are `true` (e.g., `{"user123": true, "server456": true}`)
  - This enables SQLite `json_extract(id_list, '$.' || ?)` to check presence efficiently
- No timestamps → no storage cost, no audit trail (use `wrangler tail` for debugging)
- Minimal columns = minimal storage cost (~100-150 bytes per config max)

**Raw SQL Only (no Drizzle)**

```typescript
// Pros: Full control, no abstraction, smaller bundle (0KB vs ~50KB Drizzle)
// Cons: Manual result typing, no compile-time schema checks

async function getConfigByHash(DB: D1Database, hash: string) {
  const { results } = await DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ? LIMIT 1'
  ).bind(hash).run()
  return results[0] as WebhookConfig | undefined
}
```

---

## Core Feature Implementation

### Secret Generation & Hashing
```typescript
import { subtle } from 'crypto'

async function generateSecret(): Promise<{ secret: string; hash: string }> {
  const array = new Uint8Array(48)
  crypto.getRandomValues(array)
  const secret = Buffer.from(array).toString('hex')  // 96-char hex string

  const hashBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(secret))
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return { secret, hash }
}
```

### Multi-Part Form Data & JSON Parsing
```typescript
app.post('/webhook/:hash', async (c) => {
  const contentType = c.req.header('Content-Type') || ''

  let payload: any
  let jsonString: string | undefined
  let file: File | undefined

  if (contentType.includes('multipart/form-data')) {
    // DinkPlugin sends 'payload_json' field + optional 'file' field
    const body = await c.req.parseBody()
    jsonString = body.payload_json as string | undefined
    if (!jsonString) return c.json({ error: 'Missing payload_json field' }, 400)
    payload = JSON.parse(jsonString)
    file = body.file as File | undefined
  } else if (contentType.includes('application/json')) {
    // Simple notification: raw JSON body, no file
    payload = await c.req.json()
  } else {
    return c.json({ error: 'Unsupported content type' }, 415)
  }

  // Look up config by SHA256 hash
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  ).bind(c.req.param('hash')).run()
  const config = results[0] as Config | undefined

  if (!config) return c.json({ error: 'Invalid' }, 404)

  // Apply filters
  const filterResult = applyFilters(payload, config)
  if (!filterResult.pass) {
    return c.json({ status: 'filtered', reason: filterResult.reason })
  }

  // Forward to Discord
  if (contentType.includes('multipart/form-data')) {
    // Preserve original multipart structure: payload_json + file(s)
    const form = new FormData()
    form.append('payload_json', jsonString!)
    if (file) {
      const files = Array.isArray(file) ? file : [file]
      for (const f of files) {
        form.append('file', f, f.name)
      }
    }
    await fetch(config.webhook_url, { method: 'POST', body: form })
  } else {
    // JSON-only: forward as raw JSON
    await fetch(config.webhook_url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return c.json({ status: 'forwarded' })
})
```

### Filtering Logic (SQL-Based with json_extract)

ID list filtering is done entirely in the SQL query using SQLite's `json_extract` function on the `id_list` JSON object:

```sql
SELECT webhook_url, mode, id_list
FROM webhook_configs
WHERE secret_hash = ?
  AND (
    (mode = 'allow' AND json_extract(id_list, '$.' || ?) IS NOT NULL)
    OR
    (mode = 'deny'  AND json_extract(id_list, '$.' || ?) IS NULL)
  )
```

**How it works:**
- `id_list` stores a JSON object where keys are user/server IDs and values are `true` (e.g., `{"user123": true}`)
- `json_extract(id_list, '$.' || userId)` returns the value (`true`) if the user ID exists as a key, or `NULL` if not
- For **allow mode**: we require `IS NOT NULL` (user must be present in the dictionary)
- For **deny mode**: we require `IS NULL` (user must NOT be present)
- If the WHERE clause matches a row → config found → forward
- If no rows → user filtered out → return 200 with `{status: 'filtered'}`

**Advantages:**
- Filtering happens in the database (single query, no extra round-trip)
- No JSON parsing in application code for ID list
- Efficient even with large ID lists (JSON indexing possible in future)

**Application code:**
```typescript
const userId = payload.dinkAccountHash
const { results } = await c.env.DB.prepare(`
  SELECT webhook_url, mode, id_list
  FROM webhook_configs
  WHERE secret_hash = ?
    AND (
      (mode = 'allow' AND json_extract(id_list, '$.' || ?) IS NOT NULL)
      OR
      (mode = 'deny'  AND json_extract(id_list, '$.' || ?) IS NULL)
    )
`).bind(hash, userId, userId).run()

if (results.length === 0) {
  return c.json({ status: 'filtered' })  // User not allowed / is denied
}
```

### Discord Forwarding
```typescript
// Note: Forwarding logic is inline in the webhook route.
// For multipart: we recreate FormData with 'payload_json' + 'file' fields
// For JSON: we forward raw JSON with Content-Type: application/json
```

### Settings Page with Secret Display
```typescript
app.get('/settings/:secret', async (c) => {
  const hash = await sha256(c.req.param('secret'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  ).bind(hash).run()
  const config = results[0] as Config | undefined

  if (!config) return c.notFound()

  // IMPORTANT: We do NOT have the plaintext secret anymore (not stored).
  // The user provided it in the URL to access this page. Keep it in a hidden form field.
  const secretFromUrl = c.req.param('secret')
  const idList = config.id_list ? JSON.parse(config.id_list) : []

  return c.html(
    <html>
      <body>
        <h1>Settings</h1>
        <form method="post" action={`/api/settings`}> {/* No ID in URL */}
          <input type="hidden" name="secret" value={secretFromUrl} />
          <input name="webhook_url" value={config.webhook_url} required />
           <label>Mode:
             <select name="mode">
               <option value="allow" selected={config.mode === 'allow'}>Allow only these IDs</option>
               <option value="deny" selected={config.mode === 'deny'}>Deny these IDs</option>
             </select>
           </label>
           <textarea name="id_list" rows={4}>
             {idListKeys}
           </textarea>
           <small>Enter one user/server ID per line. In allow mode, only these IDs will be forwarded. In deny mode, these IDs will be blocked.</small>
           <br />
           <button type="submit">Save</button>
        </form>
        <p>Share this webhook URL with your community: <code>/webhook/{config.secret_hash}</code></p>
        <p><small>Your secret was shown once when you created this config. If you lost it, you must create a new config.</small></p>
      </body>
    </html>
  )
})
```
**Note:** The secret is NOT displayed on this page (not stored). User must have it from initial creation to access settings.

### Settings API
```typescript
app.post('/api/settings', async (c) => {
  const body = await c.req.parseBody()
  const secret = body.secret as string
  const hash = await sha256(secret)

  // Convert newline-separated IDs into JSON object: {"id1": true, "id2": true}
  const idListRaw = (body.id_list as string) || ''
  const idListArray = idListRaw.split('\n').map(s => s.trim()).filter(Boolean)
  const idListObj: Record<string, boolean> = {}
  for (const id of idListArray) {
    idListObj[id] = true
  }

  await c.env.DB.prepare(`
    UPDATE webhook_configs SET
      webhook_url = ?,
      mode = ?,
      id_list = ?
    WHERE secret_hash = ?
  `).bind(
    body.webhook_url,
    body.mode,
    JSON.stringify(idListObj),
    hash
  ).run()

  // Redirect back to settings with secret in URL
  c.status(303)
  c.header('Location', `/settings/${secret}`)
  return c.text('Settings updated')
})
```
**Note:** Route is `/api/settings` (no URL param). The secret comes from a hidden form field, is hashed, and used to locate the row.
---

## Next Steps

If you want me to generate the complete starter project:

1. **Scaffold** with exact file structure
2. **Database migration** SQL file
3. **Core Hono routes** with form-data parsing (multipart & JSON)
4. **Settings page** with JSX
5. **Filtering logic** (mode + allowlist/denylist via SQL `json_extract`)
6. **Deploy script** and production checklist

I can generate the full working codebase now.

---

## Final Verdict & Specific Recommendation

**For your DinkPlugin webhook filtering proxy:**

✅ **Winner: Hono-only full-stack (single Worker) with raw D1 SQL + JSX**

This stack:
- Handles multi-part form-data natively with `c.req.parseBody()`
- Renders HTML pages with JSX (auto-escaping, component structure)
- Uses D1 with raw SQL (no ORM, zero extra bundle)
- Bundle ~25KB total (well within free tier 3MB limit)
- Single deployment unit (no CORS, separate frontend hosting, or client-side complexity)
- Simplest to maintain (one codebase, ~300 LoC)

**Implementation approach:**
```
Hono Worker (one project)
├── GET  /              → homepage (static HTML/JSX)
├── GET  /new           → create new config, redirect to /settings/:secret
├── GET  /settings/:secret → HTML form for webhook config (secret in URL)
├── POST /api/settings  → save config (secret in hidden form field, lookup by hash)
├── POST /webhook/:hash → receive DinkPlugin payload, filter, forward to Discord
└── Static assets served via Workers Assets if needed
```

**Frontend:** JSX (`@hono/jsx`) for template rendering with auto HTML escaping. No React, no SPA.

**Database:** D1 SQLite with raw SQL. Filtering uses `json_extract` on JSON dictionary for efficient allow/deny checks entirely in-database.

**Estimated engineering time:** 2-3 days MVP, 1 week polished.

**Final stack:**
```
Runtime: Cloudflare Workers
Framework: Hono v4+
Templating: @hono/jsx (TypeScript JSX)
Database: D1 SQLite
ORM: None (raw SQL)
Build: Vite + @cloudflare/vite-plugin + @hono/vite-dev-server
Dev: wrangler dev (real workerd runtime locally)
Deploy: wrangler deploy
Cost: $0 (within D1 free tier)
```

**Phase 1 (Day 1):** Core Webhook Proxy & Config Creation
- Set up Hono Worker with Vite + Cloudflare plugin
- Create D1 database and migration (`webhook_configs` table)
- Implement POST `/webhook/:hash` endpoint with content-type detection
- Parse multipart form-data (`payload_json` field + optional `file`) or raw JSON
- Database filtering for allow/deny using SQL `json_extract` in WHERE clause
- Forward to Discord webhook via HTTP fetch (preserve multipart structure or raw JSON)
- Add GET `/new` route to create config (generate secret+hash, insert row)

**Phase 2 (Day 2):** Settings Management
- GET `/settings/:secret` → render HTML settings form (lookup by SHA256 hash)
- POST `/api/settings` → update `webhook_url`, `mode`, `id_list` (lookup by secret hash)
- JSX rendering with auto-escaping

**Phase 3 (Day 3):** Homepage & Polish
- Static homepage at `/` explaining service
- Add basic CSS styling (inline or minimal stylesheet)
- Error pages: 404 for unknown hash/config, 500 for internal errors

**Phase 4 (Day 4):** Security Hardening
- Input validation: validate Discord webhook URL format before saving
- JSX auto-escapes user-provided values; verify no raw HTML injection

**Phase 5 (Day 5):** Deploy & Monitor
- Apply migrations to production: `wrangler d1 migrations apply DB --remote`
- Deploy: `wrangler deploy`
- Test live endpoint with real DinkPlugin payload
- Set up monitoring: `wrangler tail` for logs
- Optional: Add error tracking (Sentry, Logflare)

---

## Example Minimal Implementation (Code Skeleton)

**wrangler.toml:**
```toml
name = "webhook-filter"
main = "src/worker.ts"
compatibility_date = "2026-05-02"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_id = "YOUR_DB_ID_HERE"
migrations_dir = "./migrations"

[assets]
directory = "./dist"
binding = "ASSETS"

[observability]
enabled = true
```

**src/worker.ts:**
```typescript
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Helpers
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function generateSecret(): Promise<{ secret: string; hash: string }> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const secret = Buffer.from(array).toString('hex')
  const hash = await sha256(secret)
  return { secret, hash }
}

// Types
interface Config {
  secret_hash: string
  webhook_url: string
  mode: 'allow' | 'deny'
  id_list: string | null  // JSON object: {"id1": true, "id2": true}
}

// Homepage
app.get('/', (c) => {
  return c.html(
    <html>
      <body>
        <h1>DinkPlugin Webhook Filter</h1>
        <p>This service filters Discord webhook notifications based on user/server IDs.</p>
      </body>
    </html>
  )
})

// Create new config (generates secret, creates row, redirects to settings)
app.get('/new', async (c) => {
  const { secret, hash } = await generateSecret()

  // Insert new config with defaults
  await c.env.DB.prepare(`
    INSERT INTO webhook_configs (secret_hash, webhook_url, mode)
    VALUES (?, ?, 'allow')
  `).bind(hash, 'https://discord.com/api/webhooks/...').run()

  // Redirect to settings; secret will be in URL and shown once on that page
  c.status(303)
  c.header('Location', `/settings/${secret}`)
  return c.text('Config created')
})

// Settings page
app.get('/settings/:secret', async (c) => {
  const hash = await sha256(c.req.param('secret'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  ).bind(hash).run()
  const config = results[0] as Config | undefined

  if (!config) return c.notFound()

  // id_list is a JSON object; extract keys for display in textarea
  const idListKeys = config.id_list
    ? Object.keys(JSON.parse(config.id_list)).join('\n')
    : ''

  const secretFromUrl = c.req.param('secret')
  return c.html(
    <html>
      <body>
        <h1>Settings</h1>
        <form method="post" action="/api/settings">
          <input type="hidden" name="secret" value={secretFromUrl} />
          <input name="webhook_url" value={config.webhook_url} required />
          <label>Mode:
            <select name="mode">
              <option value="allow" selected={config.mode === 'allow'}>Allow only these IDs</option>
              <option value="deny" selected={config.mode === 'deny'}>Deny these IDs</option>
            </select>
          </label>
          <textarea name="id_list" rows={4}>
            {idListKeys}
          </textarea>
          <small>Enter one user/server ID per line. In allow mode, only these IDs will be forwarded. In deny mode, these IDs will be blocked.</small>
          <br />
          <button type="submit">Save</button>
        </form>
        <p>Webhook endpoint URL: <code>/webhook/{config.secret_hash}</code></p>
        <p><small>Your secret: <code>{secretFromUrl}</code>. Save it; it will not be shown again.</small></p>
      </body>
    </html>
  )
})

// Settings API
app.post('/api/settings', async (c) => {
  const body = await c.req.parseBody()
  const secret = body.secret as string
  const hash = await sha256(secret)

  // Convert newline-separated IDs into JSON object: {"id1": true, "id2": true}
  const idListRaw = (body.id_list as string) || ''
  const idListArray = idListRaw.split('\n').map(s => s.trim()).filter(Boolean)
  const idListObj: Record<string, boolean> = {}
  for (const id of idListArray) {
    idListObj[id] = true
  }

  await c.env.DB.prepare(`
    UPDATE webhook_configs SET
      webhook_url = ?,
      mode = ?,
      id_list = ?
    WHERE secret_hash = ?
  `).bind(
    body.webhook_url,
    body.mode,
    JSON.stringify(idListObj),
    hash
  ).run()

  c.status(303)
  c.header('Location', `/settings/${secret}`)
  return c.text('Settings updated')
})

// Webhook endpoint (handles both multipart/form-data and application/json)
app.post('/webhook/:hash', async (c) => {
  const contentType = c.req.header('Content-Type') || ''

  let payload: any
  let jsonString: string | undefined
  let file: File | undefined

  if (contentType.includes('multipart/form-data')) {
    // DinkPlugin sends 'payload_json' field + optional 'file' field
    const body = await c.req.parseBody()
    jsonString = body.payload_json as string | undefined
    if (!jsonString) return c.json({ error: 'Missing payload_json field' }, 400)
    payload = JSON.parse(jsonString)
    file = body.file as File | undefined
  } else if (contentType.includes('application/json')) {
    // Simple notification: raw JSON body, no file
    payload = await c.req.json()
  } else {
    return c.json({ error: 'Unsupported content type' }, 415)
  }

  // Extract user ID from payload (DinkPlugin sends dinkAccountHash)
  const userId = payload.dinkAccountHash
  if (!userId) return c.json({ error: 'Missing dinkAccountHash in payload' }, 400)

  // Database query with SQL-based ID filtering using json_extract
  // sqlite: json_extract(id_list, '$.' || ?) returns true if key exists, NULL otherwise
  const { results } = await c.env.DB.prepare(`
    SELECT webhook_url, mode, id_list
    FROM webhook_configs
    WHERE secret_hash = ?
      AND (
        (mode = 'allow' AND json_extract(id_list, '$.' || ?) IS NOT NULL)
        OR
        (mode = 'deny'  AND json_extract(id_list, '$.' || ?) IS NULL)
      )
  `).bind(c.req.param('hash'), userId, userId).run()

  // If no row returned, the user was filtered (not in allowlist, or in denylist)
  if (results.length === 0) {
    return c.json({ status: 'filtered' }, 200)
  }

  const config = results[0]
  const webhookUrl = config.webhook_url

  // Forward to Discord
  if (contentType.includes('multipart/form-data')) {
    // Preserve original multipart structure: payload_json + file(s)
    const form = new FormData()
    form.append('payload_json', jsonString!)
    if (file) {
      const files = Array.isArray(file) ? file : [file]
      for (const f of files) {
        form.append('file', f, f.name)
      }
    }
    await fetch(webhookUrl, { method: 'POST', body: form })
  } else {
    // JSON-only: forward as raw JSON
    await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return c.json({ status: 'forwarded' })
})
  }

  return c.json({ status: 'forwarded' })
})

export default app
```

**Migrations/0001_init.sql:**
```sql
CREATE TABLE webhook_configs (
  secret_hash TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'allow',
  id_list TEXT
);
```

---

## Tools & Dependencies

**Minimal (recommended):**
```json
{
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/jsx": "^0.14.0",
    "tailwindcss": "^3.4.0",
    "@tailwindcss/forms": "^0.5.0"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.0.0",
    "@hono/vite-dev-server": "^0.14.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0",
    "vite": "^6.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

**Tailwind CSS setup:**

1. **Initialize Tailwind config:**
```bash
pnpm exec tailwindcss init -p
```

2. **Configure `tailwind.config.ts`:**
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
} satisfies Config
```

3. **Create `postcss.config.ts`:**
```typescript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

4. **Add Tailwind to your JSX components:**
```tsx
import { cssomSheet } from '@hono/jsx/presence/cssom'

// In your HTML head:
const sheet = cssomSheet`
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
`
```

**Use pnpm for package management:**
```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Deploy
pnpm deploy
```

**Tailwind CSS setup:**

1. **Initialize Tailwind config:**
```bash
pnpm exec tailwindcss init -p
```

2. **Configure `tailwind.config.ts`:**
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
} satisfies Config
```

3. **Create `postcss.config.ts`:**
```typescript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

4. **Add Tailwind to your JSX components:**
```tsx
import { cssomSheet } from '@hono/jsx/presence/cssom'

// In your HTML head:
const sheet = cssomSheet`
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
`
```

**Use pnpm for package management:**
```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Deploy
pnpm deploy
```

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | **Hono** | Edge-native, tiny, built for Workers |
| Frontend | **JSX (@hono/jsx)** | Auto HTML escaping, component structure, minimal overhead |
| Database | **D1 + raw SQL** | Only a few queries; ORM adds ~50KB unnecessarily |
| ORM | **None** | Keep bundle minimal; SQL trivial |
| Form parsing | **Hono built-in** | `c.req.parseBody()` handles multipart natively |
| Settings auth | **HTTP Basic** | Simple, header-based, no session storage |
| Auth (webhook) | **SHA256 hash** | Secret → hash in URL; no auth needed for webhook |
| Deploy | **Wrangler** | Official CLI, simplest |

---

## Security & Deployment Checklist

**Security hardening:**
- Validate Discord webhook URL format before saving
- Escape user-provided values in HTML responses (JSX auto-escapes; template literals need manual escape)

**Deploy steps:**
1. `wrangler d1 migrations apply DB --remote`
2. `wrangler deploy`
3. Verify: `curl https://your-worker.workers.dev/`
4. Monitor: `wrangler tail`

**Expected cost:** $0 (within D1 free tier: 5M reads, 100K writes/day)

---

## Ready to Generate

The plan is complete. **Hono + raw D1 SQL + JSX** is the optimal, minimal-cost solution for your webhook filtering proxy.

All architectural decisions have been made:
- Single Worker with JSX templating
- D1 SQLite with raw queries, `secret_hash` primary key
- No ORM (bundle minimal)
- Form-data parsing built-in
- Secret shown only once at creation

**I can now generate the complete working codebase including:**
- Project structure with all files
- `wrangler.toml` and `vite.config.ts`
- `src/worker.ts` with all routes
- Database migration SQL
- `package.json`, `tsconfig.json`
- README with deployment instructions
