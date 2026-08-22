import { type Context } from 'hono'
import { generateSecret } from '../utils/crypto'
import { jsonError, getClientIP, checkRateLimit } from '../utils/db'

export async function newConfigRoute(c: Context) {
  if (c.env.DISABLE_NEW_CONFIGS) {
    return jsonError(c, 'Creation of new webhook configurations is disabled', 403)
  }

  const allowed = await checkRateLimit(c.env.CONFIG_CREATE_RATELIMIT, getClientIP(c))
  if (!allowed) {
    return jsonError(c, 'Rate limit exceeded: webhook configuration creation frequency', 429)
  }

  const { secret, hash } = await generateSecret()

  await c.env.DB.prepare(`
    INSERT INTO webhook_configs (secret_hash, webhook_url, mode)
    VALUES (?, ?, 'allow')
  `).bind(hash, '').run()

  c.status(303)
  c.header('Location', `/settings/${secret}`)
  return c.text('Config created')
}
