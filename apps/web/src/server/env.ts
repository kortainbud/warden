import 'server-only'

export const isDemo = () => process.env.WARDEN_DEMO === '1'

export const hasHelius = () => isDemo() || !!process.env.HELIUS_API_KEY
export const hasModel = () => !!process.env.ANTHROPIC_API_KEY
export const hasTelegram = () => !!process.env.TELEGRAM_BOT_TOKEN

export const id = (prefix: string) => {
  const t = Date.now().toString(36).padStart(9, '0')
  const r = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12)
  return `${prefix}_${t}${r}`
}

export async function sha256Hex(text: string | Uint8Array) {
  const data = typeof text === 'string' ? new TextEncoder().encode(text) : text
  const buf = await crypto.subtle.digest('SHA-256', data as BufferSource)
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}
