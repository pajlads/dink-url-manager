import { Hono } from 'hono'
import { jsx, jsxRenderer } from '@hono/jsx'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Use jsxRenderer for HTML responses
app.use('*', async (c, next) => {
  const renderer = jsxRenderer(({ children, head }) => (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DinkPlugin Webhook Filter</title>
        <style>
          {`
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 20px 0; }
            h1 { color: #5865F2; margin-bottom: 20px; font-size: 2rem; }
            h2 { color: #333; margin-bottom: 15px; font-size: 1.3rem; }
            p { margin-bottom: 15px; }
            code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #e91e63; }
            pre { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.85em; }
            input[type="text"], input[type="url"], textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin: 5px 0 15px; font-size: 1rem; }
            input[type="text"]:focus, input[type="url"]:focus, textarea:focus, select:focus { outline: none; border-color: #5865F2; box-shadow: 0 0 0 2px rgba(88,101,242,0.2); }
            label { display: block; margin-bottom: 5px; font-weight: 500; }
            textarea { resize: vertical; min-height: 100px; font-family: monospace; }
            button { background: #5865F2; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 1rem; transition: background 0.2s; }
            button:hover { background: #4752c4; }
            .btn-secondary { background: #6c757d; }
            .btn-secondary:hover { background: #5a6268; }
            small { display: block; color: #666; margin-top: 5px; font-size: 0.85rem; }
            .field { margin-bottom: 20px; }
            .webhook-url { background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all; margin: 10px 0; border: 1px solid #e9ecef; }
            .alert { padding: 12px; border-radius: 4px; margin: 15px 0; }
            .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .hidden { display: none; }
          `}
        </style>
      </head>
      <body>
        <div class="container">
          {children}
        </div>
      </body>
    </html>
  ))

  c.set('jsxRenderer', renderer)
  await next()
})

// ==================== Helpers ====================

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function generateSecret(): Promise<{ secret: string; hash: string }> {
  const array = new Uint8Array(48)
  crypto.getRandomValues(array)
  const secret = Buffer.from(array).toString('hex')
  const hash = await sha256(secret)
  return { secret, hash }
}

function isValidDiscordWebhookUrl(url: string): boolean {
  return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ||
         /^https:\/\/discordapp\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)
}

// ==================== Routes ====================

// Homepage
app.get('/', (c) => {
  return c.render(
    <div>
      <h1>DinkPlugin Webhook Filter</h1>
      <p>
        This service filters Discord webhook notifications from DinkPlugin based on user/server IDs.
        Configure allowlists or denylists to control which notifications reach your Discord server.
      </p>
      <div class="field">
        <a href="/new" style="text-decoration: none;">
          <button>Create New Webhook Filter</button>
        </a>
      </div>
      <h2>How It Works</h2>
      <p>
        1. <strong>Create</strong> a new webhook configuration (generates a secret key).<br />
        2. <strong>Configure</strong> your Discord webhook URL, allowed/blocked IDs, and mode.<br />
        3. <strong>Set</strong> the generated webhook URL in your DinkPlugin.<br />
        4. <strong>Filter</strong> — Discord webhooks from matching users/servers are forwarded; others are silently dropped.
      </p>
      <h2>Security</h2>
      <p>
        Your secret is shown only once at creation and never stored in plaintext.
        The secret is used to compute a hash that appears in the webhook URL.
        Only someone with the secret can modify the configuration.
      </p>
    </div>
  )
})

// Create new config
app.get('/new', async (c) => {
  const { secret, hash } = await generateSecret()

  // Insert new config with defaults
  await c.env.DB.prepare(`
    INSERT INTO webhook_configs (secret_hash, webhook_url, mode)
    VALUES (?, ?, 'allow')
  `).bind(hash, '').run()

  // Redirect to settings; secret will be in URL and shown once on that page
  c.status(303)
  c.header('Location', `/settings/${secret}`)
  return c.text('Config created')
})

// Settings page (GET)
app.get('/settings/:secret', async (c) => {
  const secret = c.req.param('secret')
  const hash = await sha256(secret)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  ).bind(hash).run()

  const config = results[0] as any | undefined

  if (!config) {
    return c.notFound()
  }

  const idList = config.id_list ? JSON.parse(config.id_list) : {}
  const idListKeys = Object.keys(idList).join('\n')

  return c.render(
    <div>
      <h1>Webhook Filter Settings</h1>

      <form method="post" action="/api/settings">
        <input type="hidden" name="secret" value={secret} />

        <div class="field">
          <label htmlFor="webhook_url">Discord Webhook URL</label>
          <input
            type="url"
            id="webhook_url"
            name="webhook_url"
            value={config.webhook_url}
            placeholder="https://discord.com/api/webhooks/..."
            required
          />
          <small>Enter your Discord channel's webhook URL</small>
        </div>

        <div class="field">
          <label htmlFor="mode">Filter Mode</label>
          <select id="mode" name="mode">
            <option value="allow" selected={config.mode === 'allow'}>
              Allow only these IDs (whitelist)
            </option>
            <option value="deny" selected={config.mode === 'deny'}>
              Deny these IDs (blacklist)
            </option>
          </select>
          <small>
            <strong>Allow mode:</strong> Only users/servers in the list will be forwarded.<br />
            <strong>Deny mode:</strong> Users/servers in the list will be blocked; all others forwarded.
          </small>
        </div>

        <div class="field">
          <label htmlFor="id_list">User/Server IDs (one per line)</label>
          <textarea
            id="id_list"
            name="id_list"
            rows="6"
            placeholder="1234567890123456789&#10;9876543210987654321"
          >{idListKeys}</textarea>
          <small>
            Enter Discord user IDs or server IDs, one per line. These IDs come from DinkPlugin notifications (dinkAccountHash field).
          </small>
        </div>

        <div class="field">
          <button type="submit">Save Settings</button>
        </div>
      </form>

      <h2>Webhook URL</h2>
      <div class="webhook-url">
        <code>{c.req.url.origin}/webhook/{hash}</code>
      </div>
      <p>
        <small>
          <strong>Important:</strong> Use this URL as your webhook in DinkPlugin.
          Keep your secret safe — it won't be shown again.
        </small>
      </p>

      <p>
        <a href="/" class="btn-secondary" style="text-decoration: none; display: inline-block; margin-top: 10px;">
          ← Back to Home
        </a>
      </p>
    </div>
  )
})

// Settings API (POST)
app.post('/api/settings', async (c) => {
  // Parse form data (supports both multipart and urlencoded)
  const body = await c.req.parseBody()
  const secret = body.secret as string
  const webhookUrl = body.webhook_url as string
  const mode = body.mode as 'allow' | 'deny'
  const idListRaw = body.id_list as string

  // Validate inputs
  if (!secret || !webhookUrl || !mode) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    return c.json({ error: 'Invalid Discord webhook URL format' }, 400)
  }

  const hash = await sha256(secret)

  // Convert newline-separated IDs into JSON object: {"id1": true, "id2": true}
  const idListArray = idListRaw
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  const idListObj: Record<string, boolean> = {}
  for (const id of idListArray) {
    idListObj[id] = true
  }

  try {
    await c.env.DB.prepare(`
      UPDATE webhook_configs SET
        webhook_url = ?,
        mode = ?,
        id_list = ?
      WHERE secret_hash = ?
    `).bind(
      webhookUrl,
      mode,
      JSON.stringify(idListObj),
      hash
    ).run()
  } catch (err) {
    console.error('Database error:', err)
    return c.json({ error: 'Failed to update settings' }, 500)
  }

  // Redirect back to settings page
  c.status(303)
  c.header('Location', `/settings/${secret}`)
  return c.text('Settings updated')
})

// Webhook endpoint (POST) - handles both multipart/form-data and application/json
app.post('/webhook/:hash', async (c) => {
  const hash = c.req.param('hash')
  const contentType = c.req.header('Content-Type') || ''

  let payload: any
  let jsonString: string | undefined
  let file: File | undefined

  try {
    if (contentType.includes('multipart/form-data')) {
      // DinkPlugin sends 'payload_json' field + optional 'file' field
      const body = await c.req.parseBody()
      jsonString = body.payload_json as string | undefined
      if (!jsonString) {
        return c.json({ error: 'Missing payload_json field' }, 400)
      }
      payload = JSON.parse(jsonString)
      file = body.file as File | undefined
    } else if (contentType.includes('application/json')) {
      // Simple notification: raw JSON body, no file
      payload = await c.req.json()
    } else {
      return c.json({ error: 'Unsupported content type' }, 415)
    }
  } catch (err) {
    console.error('Parse error:', err)
    return c.json({ error: 'Failed to parse request body' }, 400)
  }

  // Extract user ID from payload (DinkPlugin sends dinkAccountHash)
  const userId = payload.dinkAccountHash
  if (!userId) {
    return c.json({ error: 'Missing dinkAccountHash in payload' }, 400)
  }

  // Database query with SQL-based ID filtering using json_extract
  // SQLite: json_extract(id_list, '$.' || ?) returns value if key exists, NULL otherwise
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

  // If no row returned, the user was filtered (not in allowlist, or in denylist)
  if (results.length === 0) {
    return c.json({ status: 'filtered' }, 200)
  }

  const config = results[0] as any
  const webhookUrl = config.webhook_url

  // Forward to Discord
  try {
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

      await fetch(webhookUrl, {
        method: 'POST',
        body: form
      })
    } else {
      // JSON-only: forward as raw JSON
      await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (err) {
    console.error('Forward error:', err)
    return c.json({ error: 'Failed to forward to Discord' }, 502)
  }

  return c.json({ status: 'forwarded' })
})

// 404 handler
app.notFound(() => {
  return new Response('Not found', { status: 404 })
})

export default app
