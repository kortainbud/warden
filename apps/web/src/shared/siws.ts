// Sign In With Solana message, built identically on client and server.
import { createSignInMessageText } from '@solana/wallet-standard-util'

export const SIWS_TTL_MS = 10 * 60_000
export const SIWS_STATEMENT = 'Sign in to Warden. This only proves you own this wallet. It cannot move funds or approve any transaction.'

export function signInMessage({ domain, uri, address, nonce, issuedAt }: { domain: string; uri: string; address: string; nonce: string; issuedAt: string }) {
  return createSignInMessageText({
    domain,
    address,
    statement: SIWS_STATEMENT,
    uri,
    version: '1',
    chainId: 'mainnet',
    nonce,
    issuedAt,
    expirationTime: new Date(Date.parse(issuedAt) + SIWS_TTL_MS).toISOString(),
  })
}

/** Signed confirmation for actions that weaken protection (PRD: owner confirms by wallet signature). */
export function confirmMessage({ action, walletId, nonce, issuedAt }: { action: string; walletId: string; nonce: string; issuedAt: string }) {
  return `Warden: confirm a change that weakens protection.\n\nAction: ${action}\nWallet: ${walletId}\nNonce: ${nonce}\nIssued at: ${issuedAt}\n\nThis signature cannot move funds.`
}
