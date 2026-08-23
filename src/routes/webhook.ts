import { type Context } from 'hono'
import { sanitizeIdentifier } from '../utils/validation'
import { jsonError, getClientIP, checkRateLimit } from '../utils/db'
import type { WebhookPayload } from '../types'

export async function webhookRoute(c: Context) {
  const secretHash = c.req.param('hash')

  const ipAllowed = await checkRateLimit(
    c.env.WEBHOOK_IP_RATELIMIT,
    getClientIP(c)
  )
  if (!ipAllowed) {
    return jsonError(
      c,
      'Rate limit exceeded: webhook posts per second from this IP',
      429
    )
  }

  const secretAllowed = await checkRateLimit(
    c.env.WEBHOOK_SECRET_RATELIMIT,
    secretHash
  )
  if (!secretAllowed) {
    return jsonError(
      c,
      'Rate limit exceeded: webhook posts per second for this webhook configuration',
      429
    )
  }

  const contentType = c.req.header('Content-Type') || ''

  let payload: WebhookPayload
  let jsonString: string | undefined
  let file: File | undefined

  try {
    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody()
      jsonString = body.payload_json as string | undefined
      if (!jsonString) {
        return jsonError(c, 'Missing payload_json field', 400)
      }
      payload = JSON.parse(jsonString)
      file = body.file as File | undefined
    } else if (contentType.includes('application/json')) {
      payload = await c.req.json()
    } else {
      return jsonError(c, 'Unsupported content type', 415)
    }
  } catch (err) {
    console.error('Parse error:', err)
    return jsonError(c, 'Failed to parse request body', 400)
  }

  const dinkAccountHash = payload.dinkAccountHash
  const playerName = payload.playerName

  if (!dinkAccountHash || !playerName) {
    return jsonError(c, 'Both dinkAccountHash and playerName are required', 400)
  }

  const cleanHash = sanitizeIdentifier(dinkAccountHash)
  const cleanName = sanitizeIdentifier(playerName)

  if (!cleanHash || !cleanName) {
    return jsonError(c, 'Invalid identifier format', 400)
  }

  const { results } = await c.env.DB.prepare(
    `
    SELECT webhook_url
    FROM webhook_configs
    WHERE secret_hash = ?
      AND (
        (mode = 'allow' AND (
          json_extract(id_list, '$."' || ? || '"') IS NOT NULL
          OR
          json_extract(id_list, '$."' || ? || '"') IS NOT NULL
         ))
        OR
        (mode = 'deny' AND (
          json_extract(id_list, '$."' || ? || '"') IS NULL
          AND
          json_extract(id_list, '$."' || ? || '"') IS NULL
        ))
      )
  `
  )
    .bind(
      secretHash,
      cleanHash.toUpperCase(),
      cleanName.toUpperCase(),
      cleanHash.toUpperCase(),
      cleanName.toUpperCase()
    )
    .run()

  if (results.length === 0) {
    return c.json({ status: 'filtered' })
  }

  const webhookUrl = results[0].webhook_url

  try {
    if (contentType.includes('multipart/form-data')) {
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
      await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    console.error('Forward error:', err)
    return jsonError(c, 'Failed to forward to Discord', 502)
  }

  return c.json({ status: 'forwarded' })
}
