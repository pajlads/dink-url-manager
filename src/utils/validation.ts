import { MAX_IDENTIFIER_LENGTH } from '../constants'

export function isValidDiscordWebhookUrl(url: string): boolean {
  return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ||
         /^https:\/\/discordapp\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)
}

export function sanitizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === "") return trimmed
  if (!trimmed) return null
  if (trimmed.includes('\\') || trimmed.includes('"') || trimmed.includes("'")) {
    return null
  }
  if (trimmed.length > MAX_IDENTIFIER_LENGTH) return null
  return trimmed
}

export function stripComment(line: string): string {
  const hashIndex = line.indexOf('#')
  return hashIndex === -1 ? line : line.substring(0, hashIndex)
}

export function parseIdList(idListStr: string | null): import('../types').IdList {
  if (!idListStr) return {}
  try {
    const parsed = JSON.parse(idListStr)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function idListToString(idList: import('../types').IdList): string {
  const keys = Object.keys(idList).map(k => k.toLowerCase())
  return keys.length > 0 ? keys.join('\n') + '\n' : ''
}
