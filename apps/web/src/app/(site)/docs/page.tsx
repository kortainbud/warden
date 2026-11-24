import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/attio/Light'

export const metadata: Metadata = { title: 'Docs' }

const Code = ({ children }: { children: string }) => (
  <pre className="my-4 overflow-x-auto rounded-[10px] border border-line bg-[#14201b] p-4 font-mono text-[12.5px] leading-relaxed text-[#dfe8e2]">{children}</pre>
)
const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="mt-14 scroll-mt-20 text-[22px] font-semibold tracking-[-0.02em]">{children}</h2>
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</p>
const C = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[13px]">{children}</code>

const TOC = [
  ['quickstart', 'Quickstart'], ['check', 'POST /v1/check'], ['context', 'Context envelope'], ['sdk', 'TypeScript SDK'], ['prepay', 'x402 pre-pay'],
  ['holds', 'Holds and approvals'], ['codes', 'Reason codes'], ['webhooks', 'Alert webhooks'], ['api', 'Endpoints'], ['status', 'What is live'],
]

const CODES: [string, string][] = [
  ['WALLET_FROZEN', 'Kill switch is on for this wallet.'],
  ['SIMULATION_FAILED / SIMULATION_UNAVAILABLE', 'The transaction would fail, or could not be simulated (Warden fails closed).'],
  ['RECIPIENT_DENYLISTED / NOT_ON_ALLOWLIST', 'Recipient rules.'],
  ['CAP_EXCEEDED / DAILY_CAP_EXCEEDED / RATE_LIMITED', 'Spending and rate limits.'],
  ['PROGRAM_NOT_ALLOWED / UNKNOWN_PROGRAM_OUTFLOW', 'An unapproved or unknown program moves funds.'],
  ['SETTINGS_CHANGE_BY_AGENT', 'The agent tried to change smart account settings.'],
  ['TOKEN_APPROVAL / AUTHORITY_CHANGE', 'Grants a third party control of tokens (held).'],
  ['RECIPIENT_HIGH_RISK', 'Threat Network flags the recipient.'],
  ['ADDRESS_FROM_UNTRUSTED_CONTENT', 'The recipient address appears in untrusted content and not in the owner’s request.'],
  ['UNTRUSTED_ORIGIN_NEW_RECIPIENT', 'A new recipient, and the payment was triggered by untrusted content (held).'],
  ['INTENT_INCONSISTENT / INTENT_MODEL_UNAVAILABLE', 'The intent check disagrees with the task, or could not run (held).'],
  ['PRICE_ANOMALY', 'An x402 endpoint asks far more than it usually charges (held).'],
]

export default function Docs() {
  return (
    <>
    <main className="mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 space-y-1 text-[13.5px]">
          {TOC.map(([id, t]) => <a key={id} href={`#${id}`} className="block rounded-[6px] px-2 py-1 text-ink-2 hover:bg-sunken">{t}</a>)}
        </nav>
      </aside>
      <article className="max-w-[760px]">
        <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Docs</h1>
        <P>Warden sits between your agent and its signature. Your agent sends the transaction it wants to sign, plus the context it was working from. Warden decodes it, simulates it against mainnet, runs rules, scores the recipient, checks intent, and returns approve, hold or block.</P>

        <H2 id="quickstart">Quickstart</H2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] text-ink-2">
          <li><Link href="/app" className="underline">Sign in</Link> with the wallet that owns your agents.</li>
          <li>Add the agent wallet address under Wallets. Warden backfills 30 days and starts monitoring.</li>
          <li>Create an API key under Settings.</li>
          <li>Before your agent signs, send the transaction to <C>POST /v1/check</C>. Sign and submit only if <C>status</C> is <C>approved</C>.</li>
          <li>Leave the wallet in shadow mode for a few days. When the verdicts look right, switch the policy to enforce.</li>
        </ol>

        <H2 id="check">POST /v1/check</H2>
        <P>Send the serialized transaction (legacy or v0, unsigned or partially signed) as base64. The wallet can be its Warden id or its address.</P>
        <Code>{`curl https://YOUR-WARDEN-HOST/v1/check \\
  -H "Authorization: Bearer wk_live_..." \\
  -H "content-type: application/json" \\
  -d '{
    "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "agent_name": "Scout",
    "transaction": "AQAAAAAAAAAAAAAA...",
    "context": {
      "task": { "text": "Buy the weather dataset", "source": "owner" },
      "trigger": { "source": "web", "origin": "https://vendor.example/docs", "excerpt": "..." }
    }
  }'`}</Code>
        <Code>{`{
  "id": "chk_0m3x...",
  "verdict": "hold",            // what Warden decided
  "enforced": "hold",           // what applies (shadow mode enforces approve)
  "status": "held",             // approved | held | blocked
  "mode": "enforce",
  "score": 71,
  "summary": "Agent Scout wants to send 25 USDC to a wallet created 2 hours ago. Instruction came from a webpage.",
  "reasons": [{ "code": "UNTRUSTED_ORIGIN_NEW_RECIPIENT", "stage": "intent", "severity": "hold", "message": "..." }],
  "simulated": { "ok": true, "vault_delta": [{ "mint": "EPjF...", "symbol": "USDC", "amount": "-25", "usd": 25 }] },
  "transaction": null,
  "cosign": "not_protected",
  "latency_ms": 212,
  "stage_ms": { "decode": 1, "simulate": 131, "rules_reputation_anomaly": 18 },
  "expires_at": "2026-11-24T18:15:00.000Z"
}`}</Code>
        <P>A transaction that is not signed by the wallet you name is rejected with <C>422 WALLET_NOT_SIGNER</C>.</P>

        <H2 id="context">Context envelope</H2>
        <P>The intent check works on provenance: did a trusted principal ask for this payment, or did untrusted content cause it? Tag every piece of context with its source. Missing context is treated as untrusted, never as a pass.</P>
        <ul className="mt-3 space-y-1 text-[14.5px] text-ink-2">
          <li><span className="font-medium text-ink">Trusted:</span> <C>owner</C>, <C>system</C>, <C>schedule</C></li>
          <li><span className="font-medium text-ink">Untrusted:</span> <C>agent</C>, <C>tool_output</C>, <C>web</C>, <C>social</C>, <C>onchain</C>, <C>payment_request</C></li>
        </ul>
        <P>Warden stores context as a hash plus excerpts of up to 500 characters. Hidden text (zero-width characters, base64, Morse, mixed scripts) is normalised before checking and raises risk on its own.</P>

        <H2 id="sdk">TypeScript SDK</H2>
        <P>The <C>@warden/sdk</C> package wraps the API. <C>guard()</C> throws a typed error unless the transaction is approved.</P>
        <Code>{`import { Warden, WardenBlocked, WardenHeld } from "@warden/sdk";

const warden = new Warden({ apiKey: process.env.WARDEN_API_KEY!, baseUrl: "https://YOUR-WARDEN-HOST", wallet: AGENT_WALLET });

try {
  await warden.guard(tx, { task: { text: task, source: "owner" } }); // VersionedTransaction or base64
  const sig = await connection.sendTransaction(signed(tx));
} catch (e) {
  if (e instanceof WardenHeld) await warden.waitForApproval(e.check.id); // resolves on approve, throws on deny/expiry
  else if (e instanceof WardenBlocked) console.warn(e.check.reasons);
  else throw e;
}`}</Code>

        <H2 id="prepay">x402 pre-pay</H2>
        <P>Before paying a 402 response from the agent’s spend wallet, check the payment request. Warden scores the payee, compares the price with what this endpoint charged before, and records the 402 as untrusted context.</P>
        <Code>{`POST /v1/prepay
{
  "wallet": "<spend wallet>",
  "payment_request": { "payTo": "...", "maxAmountRequired": "50000", "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                       "resource": "https://api.example.com/v1/forecast", "network": "solana" },
  "context": { "task": { "text": "Get tomorrow's forecast", "source": "schedule" } }
}`}</Code>

        <H2 id="holds">Holds and approvals</H2>
        <P>A hold raises a critical alert with a plain-language summary. Approve or deny in the dashboard. Approving needs a signature from your owner wallet, so a stolen session cannot approve money out. No answer before the wallet’s timeout means deny. Poll <C>GET /v1/checks/:id</C> or use <C>waitForApproval</C> in the SDK.</P>

        <H2 id="codes">Reason codes</H2>
        <div className="mt-4 overflow-hidden rounded-[10px] border border-line">
          {CODES.map(([c, d]) => (
            <div key={c} className="grid grid-cols-[minmax(0,1fr)] gap-1 border-b border-line px-4 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4">
              <code className="break-words font-mono text-[12.5px]">{c}</code><span className="text-[13.5px] text-ink-2">{d}</span>
            </div>
          ))}
        </div>

        <H2 id="webhooks">Alert webhooks</H2>
        <P>Webhook channels receive JSON signed with HMAC-SHA256. Verify before trusting a delivery:</P>
        <Code>{`const ts = req.headers["x-warden-timestamp"];
const expected = "v1=" + createHmac("sha256", secret).update(\`\${ts}.\${rawBody}\`).digest("hex");
if (!timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers["x-warden-signature"]))) reject();
if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) reject();`}</Code>

        <H2 id="api">Endpoints</H2>
        <div className="mt-4 overflow-hidden rounded-[10px] border border-line font-mono text-[12.5px]">
          {[
            ['POST', '/v1/check', 'Check a transaction'], ['POST', '/v1/prepay', 'Check an x402 payment request'],
            ['GET', '/v1/checks', 'List checks (?wallet, ?verdict, ?status)'], ['GET', '/v1/checks/:id', 'One check, including hold status'],
            ['GET', '/v1/wallets', 'List wallets'], ['POST', '/v1/wallets', 'Start monitoring an address'], ['GET', '/v1/wallets/:id/events', 'Decoded activity feed'],
            ['GET', '/v1/wallets/:id/policy', 'Current policy and history'], ['PATCH', '/v1/wallets/:id/policy', 'Tighten a policy (loosening needs owner signature)'],
            ['POST', '/v1/wallets/:id/freeze', 'Kill switch for one wallet'], ['POST', '/v1/freeze-all', 'Kill switch for every wallet'],
            ['GET', '/v1/alerts', 'Alerts'], ['GET', '/v1/reputation/:address', 'Threat Network score with reasons'], ['POST', '/v1/reports', 'Report a scam address'],
          ].map(([m, p, d]) => (
            <div key={p + m} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2 border-b border-line px-4 py-2 last:border-0 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="text-muted">{m}</span><span>{p}</span><span className="col-span-2 font-sans text-[13px] text-ink-2 sm:col-span-1">{d}</span>
            </div>
          ))}
        </div>

        <H2 id="status">What is live</H2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14.5px] text-ink-2">
          <li>Monitoring with 30-day backfill, decoded feed, anomaly and rule alerts, kill switch.</li>
          <li>The check service: decode, mainnet simulation, rules, Threat Network, behaviour, provenance rules and the intent model, with shadow and enforce modes.</li>
          <li>x402 pre-pay checks, holds with owner-signed approval, webhook and Slack alerts.</li>
          <li><span className="font-medium text-ink">Not yet:</span> protected smart accounts with Warden co-signing (they ship after an external audit), push notifications, email, fund tracing, Python SDK and the Agent Kit plugin.</li>
        </ul>
      </article>
    </main>
    <Footer />
    </>
  )
}
