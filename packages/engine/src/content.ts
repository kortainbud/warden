// Untrusted-content handling for the intent check: normalise text, flag encoding tricks,
// and pull out any Solana addresses (including ones hidden in base64).

import { isAddress } from '@warden/decoder'

export type ContextSource =
  | 'owner' | 'system' | 'schedule' | 'agent' | 'tool_output' | 'web' | 'social' | 'onchain' | 'payment_request'

export const TRUSTED_SOURCES = new Set<ContextSource>(['owner', 'system', 'schedule'])
export const UNTRUSTED_SOURCES = new Set<ContextSource>(['tool_output', 'web', 'social', 'onchain', 'payment_request'])

export const SOURCE_LABEL: Record<ContextSource, string> = {
  owner: 'the owner',
  system: 'the system prompt',
  schedule: 'a schedule',
  agent: 'the agent itself',
  tool_output: 'tool output',
  web: 'a webpage',
  social: 'a social post',
  onchain: 'onchain data',
  payment_request: 'a payment request',
}

export interface ContextItem {
  source: ContextSource
  origin?: string
  hash?: string
  excerpt?: string
}

export interface ContextEnvelope {
  task?: { text: string; source: ContextSource; ts?: string }
  trigger?: ContextItem
  recent_inputs?: ContextItem[]
  agent_reasoning?: string
}

export type ContentFlag = 'zero_width' | 'bidi_control' | 'base64_payload' | 'morse' | 'mixed_script'

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g
const BASE64_RUN = /[A-Za-z0-9+/]{40,}={0,2}/g
const MORSE = /(?:[.\-\u2212\u2013\u2014\u00B7\u2022]{1,7}[ /|]+){8,}[.\-\u2212\u2013\u2014\u00B7\u2022]{1,7}/
const CYRILLIC_GREEK = /[\u0370-\u03FF\u0400-\u04FF]/
const LATIN = /[A-Za-z]/

const ADDRESS_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g

export interface NormalizedContent {
  text: string
  /** Text recovered from encodings (decoded base64), also searched for addresses. */
  decoded: string[]
  flags: ContentFlag[]
}

export function normalize(input: string): NormalizedContent {
  const flags = new Set<ContentFlag>()
  if (new RegExp(ZERO_WIDTH.source).test(input)) flags.add('zero_width')
  if (new RegExp(BIDI.source).test(input)) flags.add('bidi_control')
  let text = input.normalize('NFKC').replace(ZERO_WIDTH, '').replace(BIDI, '')
  if (MORSE.test(text)) flags.add('morse')
  for (const word of text.split(/\s+/)) {
    if (word.length > 2 && CYRILLIC_GREEK.test(word) && LATIN.test(word)) {
      flags.add('mixed_script')
      break
    }
  }
  const decoded: string[] = []
  for (const run of text.match(BASE64_RUN) ?? []) {
    if (isAddress(run)) continue
    try {
      const bin = atob(run)
      const printable = [...bin].filter((c) => c >= ' ' && c <= '~').length
      if (bin.length >= 24 && printable / bin.length > 0.9) {
        decoded.push(bin)
        flags.add('base64_payload')
      }
    } catch {
      /* not base64 */
    }
  }
  text = text.replace(/\s+/g, ' ').trim()
  return { text, decoded, flags: [...flags] }
}

/** All valid Solana addresses in a piece of text (after normalisation and decoding). */
export function addressesIn(n: NormalizedContent): string[] {
  const out = new Set<string>()
  for (const t of [n.text, ...n.decoded]) for (const m of t.match(ADDRESS_RE) ?? []) if (isAddress(m)) out.add(m)
  return [...out]
}

export function isUntrusted(source: ContextSource | undefined): boolean {
  return !source || !TRUSTED_SOURCES.has(source)
}
