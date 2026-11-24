// Builds a real, unsigned mainnet transaction from the dashboard's "Test a transaction" form,
// so owners can run the full check (with simulation) without writing code. Nothing is signed or sent.

import 'server-only'
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js'
import { MINTS, isAddress } from '@warden/decoder'
import { rpc } from './helius'
import { isDemo } from './env'
import { HttpError } from './http'

const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

const ataOf = (owner: PublicKey, mint: PublicKey) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA)[0]

function transferChecked(src: PublicKey, mint: PublicKey, dst: PublicKey, owner: PublicKey, amount: bigint, decimals: number) {
  const data = Buffer.alloc(10)
  data.writeUInt8(12, 0)
  data.writeBigUInt64LE(amount, 1)
  data.writeUInt8(decimals, 9)
  return new TransactionInstruction({
    programId: TOKEN,
    keys: [
      { pubkey: src, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: dst, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  })
}

function createAtaIdempotent(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ATA,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  })
}

export async function buildTestTransaction(from: string, to: string, asset: 'SOL' | 'USDC', amount: number): Promise<string> {
  if (!isAddress(to)) throw new HttpError(400, 'INVALID_RECIPIENT', 'Enter a valid Solana address for the recipient.')
  if (!(amount > 0) || amount > 1e9) throw new HttpError(400, 'INVALID_AMOUNT', 'Enter an amount greater than zero.')
  const payer = new PublicKey(from), dest = new PublicKey(to)
  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 })]
  if (asset === 'SOL') {
    ixs.push(SystemProgram.transfer({ fromPubkey: payer, toPubkey: dest, lamports: BigInt(Math.round(amount * 1e9)) }))
  } else {
    const mint = new PublicKey(MINTS.usdc)
    const dstAta = ataOf(dest, mint)
    ixs.push(createAtaIdempotent(payer, dstAta, dest, mint))
    ixs.push(transferChecked(ataOf(payer, mint), mint, dstAta, payer, BigInt(Math.round(amount * 1e6)), 6))
  }
  const blockhash = isDemo()
    ? '11111111111111111111111111111111'
    : (await rpc<{ value: { blockhash: string } }>('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash
  const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message()
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString('base64')
}
