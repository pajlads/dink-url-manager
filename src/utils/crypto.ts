import { SECRET_BYTE_LENGTH } from '../constants'

export async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateSecret(): Promise<{
  secret: string
  hash: string
}> {
  const array = new Uint8Array(SECRET_BYTE_LENGTH)
  crypto.getRandomValues(array)
  const secret = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const hash = await sha256(secret)
  return { secret, hash }
}
