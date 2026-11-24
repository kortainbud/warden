import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Keypair, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, TransactionInstruction,
} from '@solana/web3.js'
import { createTransferCheckedInstruction, createApproveInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  base58Decode, base58Encode, decodeInstructions, describeAction, formatUnits, instructionsOf, isAddress, isWritable,
  parseTransaction, recipientsOf, signers, PROGRAMS, MINTS,
} from '../src/index.ts'

const blockhash = '11111111111111111111111111111111'

test('base58 round trip and address check', () => {
  const k = Keypair.generate().publicKey
  assert.equal(base58Encode(k.toBytes()), k.toBase58())
  assert.deepEqual(base58Decode(k.toBase58()), k.toBytes())
  assert.ok(isAddress(k.toBase58()))
  assert.ok(!isAddress('not-an-address'))
  assert.ok(!isAddress('0OIl'))
})

test('legacy transaction: SOL transfer + compute budget + memo', () => {
  const from = Keypair.generate(), to = Keypair.generate().publicKey
  const tx = new Transaction({ feePayer: from.publicKey, recentBlockhash: blockhash })
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
    .add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: 1_500_000_000 }))
    .add(new TransactionInstruction({ programId: new PublicKey(PROGRAMS.memo), keys: [], data: Buffer.from('pay invoice 42') }))
  const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  const parsed = parseTransaction(new Uint8Array(bytes))
  assert.equal(parsed.message.version, 'legacy')
  assert.deepEqual(signers(parsed.message), [from.publicKey.toBase58()])
  assert.equal(parsed.signed[0], false)
  const actions = decodeInstructions(instructionsOf(parsed.message))
  assert.equal(actions[0]!.kind, 'compute_budget')
  assert.deepEqual(actions[1], { kind: 'sol_transfer', from: from.publicKey.toBase58(), to: to.toBase58(), lamports: 1_500_000_000n })
  assert.deepEqual(actions[2], { kind: 'memo', text: 'pay invoice 42' })
  assert.equal(describeAction(actions[1]!), `Send 1.5 SOL to ${to.toBase58().slice(0, 4)}…${to.toBase58().slice(-4)}`)
  assert.ok(isWritable(parsed.message, 0))
  assert.deepEqual(recipientsOf(actions, [], new Set([from.publicKey.toBase58()])), [to.toBase58()])
})

test('v0 transaction: token transferChecked and approve', () => {
  const owner = Keypair.generate().publicKey, src = Keypair.generate().publicKey, dst = Keypair.generate().publicKey
  const delegate = Keypair.generate().publicKey
  const mint = new PublicKey(MINTS.usdc)
  const msg = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: blockhash,
    instructions: [
      createTransferCheckedInstruction(src, mint, dst, owner, 4_200_000_000n, 6, [], TOKEN_PROGRAM_ID),
      createApproveInstruction(src, delegate, owner, 10n ** 12n),
    ],
  }).compileToV0Message()
  const bytes = new VersionedTransaction(msg).serialize()
  const parsed = parseTransaction(bytes)
  assert.equal(parsed.message.version, 0)
  const [t, a] = decodeInstructions(instructionsOf(parsed.message))
  assert.equal(t!.kind, 'token_transfer')
  if (t!.kind === 'token_transfer') {
    assert.equal(t.amount, 4_200_000_000n)
    assert.equal(t.decimals, 6)
    assert.equal(t.mint, MINTS.usdc)
    assert.equal(t.destination, dst.toBase58())
  }
  assert.equal(describeAction(t!).startsWith('Send 4,200 USDC'), true)
  assert.equal(a!.kind, 'token_approve')
  if (a!.kind === 'token_approve') assert.equal(a.delegate, delegate.toBase58())
})

test('unknown programs and malformed data never throw', () => {
  const prog = Keypair.generate().publicKey.toBase58()
  const [u, bad] = decodeInstructions([
    { programId: prog, accounts: ['a'], data: new Uint8Array([1, 2, 3]) },
    { programId: PROGRAMS.system, accounts: [], data: new Uint8Array([2]) },
  ])
  assert.equal(u!.kind, 'unknown')
  assert.equal(bad!.kind, 'unknown')
})

test('Jupiter and Squads are recognised by discriminator', () => {
  const disc = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'))
  const [j, s, x] = decodeInstructions([
    { programId: PROGRAMS.jupiter, accounts: [], data: disc('e517cb977ae3ad2a00') },
    { programId: PROGRAMS.squadsSmartAccount, accounts: ['settings'], data: disc('2b66f859e7616886') },
    { programId: PROGRAMS.squadsSmartAccount, accounts: ['settings'], data: disc('338d4e85462f5f7c') },
  ])
  assert.deepEqual(j, { kind: 'swap', program: PROGRAMS.jupiter, venue: 'Jupiter', route: 'route' })
  assert.equal(s!.kind === 'smart_account' && s.op, 'execute')
  assert.equal(x!.kind === 'smart_account' && x.op, 'settings_change')
})

test('formatUnits', () => {
  assert.equal(formatUnits(1234567890n, 9), '1.234567')
  assert.equal(formatUnits(-25_000_000n, 6), '-25')
  assert.equal(formatUnits(0n, 6), '0')
})
