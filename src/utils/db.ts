import type { Context } from 'hono'
import type { WebhookConfig } from '../types'

export async function getConfigByHash(
  c: Context,
  hash: string
): Promise<WebhookConfig | null> {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM webhook_configs WHERE secret_hash = ?'
  )
    .bind(hash)
    .run()

  return (results[0] as WebhookConfig) ?? null
}

export function jsonError(
  c: Context,
  message: string,
  status: number
): Response {
  return c.json({ error: message }, status)
}

export function getClientIP(c: Context): string {
  const cfConnectingIP = c.req.header('CF-Connecting-IP')
  if (cfConnectingIP) return cfConnectingIP

  const xForwardedFor = c.req.header('X-Forwarded-For')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()

  const xRealIP = c.req.header('X-Real-IP')
  if (xRealIP) return xRealIP

  return c.req.ip || ''
}

export async function checkRateLimit(
  limiter: RateLimit,
  key: string
): Promise<boolean> {
  const { success } = await limiter.limit({ key })
  return success
}
