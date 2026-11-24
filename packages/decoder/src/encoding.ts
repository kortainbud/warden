// Dependency-free base58 / base64 helpers and a little-endian byte reader.

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const MAP: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]))

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  const digits: number[] = []
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  return '1'.repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join('')
}

export function base58Decode(text: string): Uint8Array {
  let zeros = 0
  while (zeros < text.length && text[zeros] === '1') zeros++
  const bytes: number[] = []
  for (let i = zeros; i < text.length; i++) {
    const v = MAP[text[i]!]
    if (v === undefined) throw new Error(`Invalid base58 character "${text[i]}"`)
    let carry = v
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  const out = new Uint8Array(zeros + bytes.length)
  out.set(bytes.reverse(), zeros)
  return out
}

/** A syntactically valid Solana public key (32 bytes of base58). */
export function isAddress(text: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) return false
  try {
    return base58Decode(text).length === 32
  } catch {
    return false
  }
}

export function base64Decode(text: string): Uint8Array {
  const bin = atob(text)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function base64Encode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

export class Reader {
  offset = 0
  readonly bytes: Uint8Array
  private readonly view: DataView
  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  get remaining() {
    return this.bytes.length - this.offset
  }
  private need(n: number) {
    if (this.remaining < n) throw new Error('Unexpected end of data')
  }
  u8() {
    this.need(1)
    return this.bytes[this.offset++]!
  }
  u32() {
    this.need(4)
    const v = this.view.getUint32(this.offset, true)
    this.offset += 4
    return v
  }
  u64() {
    this.need(8)
    const v = this.view.getBigUint64(this.offset, true)
    this.offset += 8
    return v
  }
  take(n: number) {
    this.need(n)
    const out = this.bytes.subarray(this.offset, this.offset + n)
    this.offset += n
    return out
  }
  pubkey() {
    return base58Encode(this.take(32))
  }
  /** Solana "compact-u16" (shortvec) length prefix. */
  shortvec() {
    let len = 0
    for (let shift = 0; shift < 21; shift += 7) {
      const b = this.u8()
      len |= (b & 0x7f) << shift
      if ((b & 0x80) === 0) return len
    }
    throw new Error('Invalid shortvec')
  }
}
