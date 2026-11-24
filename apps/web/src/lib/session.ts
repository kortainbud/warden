'use client'

import { getWallets } from '@wallet-standard/app'
import { create } from 'zustand'
import { base58Encode } from '@warden/decoder'
import { SIWS_STATEMENT, SIWS_TTL_MS, signInMessage } from '@/shared/siws'

export interface StdAccount { address: string; publicKey: Uint8Array; chains: readonly string[] }
export interface StdWallet { name: string; icon: string; chains: readonly string[]; accounts: readonly StdAccount[]; features: Record<string, unknown> }
type ConnectFeature = { connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly StdAccount[] }> }
type SignMessageFeature = { signMessage: (...inputs: { account: StdAccount; message: Uint8Array }[]) => Promise<{ signature: Uint8Array; signedMessage?: Uint8Array }[]> }
type SignInFeature = { signIn: (...inputs: Record<string, string>[]) => Promise<{ account: StdAccount; signedMessage: Uint8Array; signature: Uint8Array }[]> }

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const WALLET_KEY = 'warden.wallet'

export function solanaWallets(): StdWallet[] {
  return (getWallets().get() as unknown as StdWallet[]).filter(
    (w) => w.chains.some((c) => c.startsWith('solana:')) && ('solana:signIn' in w.features || ('standard:connect' in w.features && 'solana:signMessage' in w.features)),
  )
}

interface SessionState {
  address: string | null
  demo: boolean
  checked: boolean
  refresh: () => Promise<void>
  signIn: (wallet: StdWallet) => Promise<string>
  signOut: () => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
  address: null,
  demo: false,
  checked: false,
  refresh: async () => {
    try {
      const b = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json())
      set({ address: b.address ?? null, demo: !!b.demo, checked: true })
    } catch {
      set({ checked: true })
    }
  },
  signIn: async (wallet) => {
    const n = await fetch('/api/auth/nonce', { cache: 'no-store' }).then((r) => r.json())
    if (!n.nonce) throw new Error(n.error ?? 'Sign-in is unavailable right now.')
    let address: string, signedMessage: Uint8Array, signature: Uint8Array
    const native = wallet.features['solana:signIn'] as SignInFeature | undefined
    if (native) {
      const [out] = await native.signIn({
        domain: n.domain, uri: n.uri, statement: SIWS_STATEMENT, version: '1', chainId: 'mainnet',
        nonce: n.nonce, issuedAt: n.issuedAt, expirationTime: new Date(Date.parse(n.issuedAt) + SIWS_TTL_MS).toISOString(),
      })
      address = out!.account.address
      signedMessage = out!.signedMessage
      signature = out!.signature
    } else {
      const { accounts } = await (wallet.features['standard:connect'] as ConnectFeature).connect()
      const account = accounts.find((a) => a.chains.some((c) => c.startsWith('solana:'))) ?? accounts[0]
      if (!account) throw new Error('The wallet did not share a Solana account.')
      const message = new TextEncoder().encode(signInMessage({ domain: n.domain, uri: n.uri, address: account.address, nonce: n.nonce, issuedAt: n.issuedAt }))
      const [res] = await (wallet.features['solana:signMessage'] as SignMessageFeature).signMessage({ account, message })
      address = account.address
      signedMessage = res!.signedMessage ?? message
      signature = res!.signature
    }
    const v = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, signature: base58Encode(signature), signedMessage: toB64(signedMessage) }),
    })
    const b = await v.json()
    if (!v.ok) throw new Error(b.reason ? `${b.error} (${b.reason})` : (b.error ?? 'Sign-in failed.'))
    try { localStorage.setItem(WALLET_KEY, wallet.name) } catch { /* private mode */ }
    set({ address: b.address })
    return b.address as string
  },
  signOut: async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    set({ address: null })
  },
}))

/** Sign a confirmation message with the owner's wallet (the one used to sign in, if still available). */
export async function signWithOwnerWallet(owner: string, message: string): Promise<string> {
  const all = solanaWallets()
  let preferred: string | null = null
  try { preferred = localStorage.getItem(WALLET_KEY) } catch { /* ignore */ }
  const ordered = [...all.filter((w) => w.name === preferred), ...all.filter((w) => w.name !== preferred)]
  if (!ordered.length) throw new Error('No Solana wallet found in this browser. Open Warden where your owner wallet is installed.')
  for (const w of ordered) {
    const sign = w.features['solana:signMessage'] as SignMessageFeature | undefined
    const connect = w.features['standard:connect'] as ConnectFeature | undefined
    if (!sign || !connect) continue
    const { accounts } = await connect.connect()
    const account = accounts.find((a) => a.address === owner)
    if (!account) continue
    const [res] = await sign.signMessage({ account, message: new TextEncoder().encode(message) })
    return base58Encode(res!.signature)
  }
  throw new Error(`Switch your wallet to the owner account ${owner.slice(0, 4)}…${owner.slice(-4)} and try again.`)
}
