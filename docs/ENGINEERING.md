# Warden — Engineering Design

24 Nov 2026 · Quadri Agboluaje

How Warden's Monitor, Firewall and Threat Network are built on Solana. Companion to the [PRD](./PRD.md).

## Architecture at a glance

The agent's transactions go through Warden's check service before they can reach the vault. The monitor watches everything onchain independently, so even activity that skips the firewall is seen.

The check service is the only latency-critical path; everything below it runs asynchronously or only on risky checks.

_(Architecture diagram not included in pasted text.)_

## Wallet and signing model

**Decision:** build v1 on the Squads Smart Account program, with a 2-of-2 signer set (agent + Warden) and the owner as settings authority. It is onchain, so "Warden can block but never steal" is enforced by the program rather than by trust in Warden.

Why Squads Smart Account:

- **Funds sit in a vault controlled by the program.** A smart account has multiple signers with permissions, a signing threshold, optional admin control, time locks and spending limits (Squads docs).
- **No proposal round-trip.** `executeTransactionSync` runs instructions out of the vault in one transaction co-signed to threshold, with no stored transaction, proposal or vote (Solace docs). This is what keeps latency close to a normal transaction.
- **Native spending limits** by token, amount, destination and period (daily, weekly, monthly) cover the basic caps, so Warden doesn't rebuild them (Squads policies).

### Roles

| Role | Key holder | Can do | Cannot do |
|---|---|---|---|
| Agent signer | The customer's agent (local key, or Turnkey / Privy held) | Propose and co-sign vault transactions | Move funds without Warden |
| Warden signer | Warden, one key per wallet in KMS/HSM | Co-sign after checks pass | Move funds without the agent; change settings |
| Settings authority | The owner (hardware wallet or passkey) | Add/remove signers, change threshold, withdraw via recovery | Nothing is blocked; this is the escape hatch |

### Belt and braces: post-state assertions

Warden appends Lighthouse assertion instructions to each approved transaction, asserting the vault's balances after execution match what simulation predicted. If state changes between check and execution, the transaction reverts. Because Warden signs the full message, the agent can't strip the assertions.

### Failure modes

| Situation | Behavior |
|---|---|
| Warden API down | Protected wallets can't transact (fail closed). Owner can use the settings authority to swap Warden out or withdraw. |
| Agent key stolen | Attacker still needs Warden's signature; every tx goes through the firewall. Owner rotates the agent signer. |
| Warden key stolen | Attacker still needs the agent's key. Warden rotates the key via the owner. |
| Owner key stolen | Out of Warden's control; Monitor alerts on any settings change instantly. |

Monitor-only wallets use no smart account: Warden only watches the address.

## Firewall engine

The firewall is a stateless check service that returns a verdict and, on approve, Warden's signature. The fast path targets p99 under 250 ms; the intent model only runs when a cheaper stage flags risk.

### Request lifecycle

1. SDK builds the agent's instructions, wraps them in `executeTransactionSync`, and sends `POST /v1/check` with the unsigned message plus a context envelope (see Intent check).
2. **Decode:** parse every instruction with known program IDLs (System, SPL Token, Token-2022, Jupiter, Hyperliquid bridge, x402 facilitators, payment channels). Unknown programs raise risk.
3. **Simulate:** `simulateTransaction` against a dedicated RPC with accounts returned; compute exact pre/post balances for the vault and every touched account.
4. **Rules:** evaluate the wallet's policy (caps, allow/deny lists, allowed programs, rate limits, time windows). Compiled to an in-memory decision tree per wallet; under 1 ms.
5. **Reputation:** look up every recipient, program and x402 payee in the Threat Network (Redis hot cache, Postgres fallback).
6. **Anomaly:** compare amount, recipient novelty, time of day and velocity against the wallet's baseline.
7. **Intent (conditional):** run only if steps 4 to 6 produce a risk score above the wallet threshold, or the tx sends value to a new recipient.
8. **Verdict:** combine stage scores into approve / hold / block with reasons. Log everything.
9. **On approve:** append Lighthouse assertions, sign with the wallet's Warden key via KMS, return the partially signed transaction. The agent adds its signature and submits.

### Latency budget (fast path, p99)

| Stage | Budget |
|---|---|
| Network to Warden edge | 30 ms |
| Decode | 5 ms |
| Simulate | 120 ms |
| Rules + reputation + anomaly | 25 ms |
| Assertions + KMS sign | 40 ms |
| Overhead | 30 ms |
| **Total** | **250 ms** |

**Pre-approved routes:** a wallet can mark recipient + program pairs (for example its own exchange deposit address) as trusted. These skip intent checks and anomaly holds but are still simulated and asserted.

### Verdict scoring

Each stage emits a score from 0 to 100 and optional hard flags. Any hard flag (denylisted recipient, rule breach, simulated outflow above cap, unknown program with SOL/token outflow) means block. Otherwise a weighted score above the wallet's hold threshold means hold. Weights start hand-tuned and are later learned from owner overrides.

## Intent check

The intent check asks one question: did a trusted principal ask for this, or did untrusted content cause it? It works on provenance, not on reading the agent's mind.

### Context envelope (sent by the SDK)

```json
{
  "task": {"text": "Rebalance to 60/40 SOL/USDC", "source": "owner", "ts": "..."},
  "trigger": {"source": "tool_output", "origin": "https://example.com/docs", "excerpt": "..."},
  "recent_inputs": [{"source": "web", "hash": "...", "excerpt": "..."}],
  "agent_reasoning": "Paying 4,200 USDC to the API listed in the docs"
}
```

- `source` is one of: `owner`, `system`, `schedule`, `agent`, `tool_output`, `web`, `social`, `onchain`, `payment_request`. The SDK tags this automatically for Agent Kit / ElizaOS plugins; custom agents tag it themselves.
- Missing envelope = treated as untrusted context (higher risk), never as a pass.

### Checks

1. **Provenance rule (deterministic):** value moving to a new recipient whose address first appears in untrusted content (web, social, tool_output, payment_request) is a hold, regardless of the model.
2. **Address origin match:** does the recipient address string appear in an untrusted input but not in the owner's task or allowlist? Hard flag.
3. **Model judgement:** a small, fast model (hosted, structured output) receives the decoded transaction summary, the owner task and the trigger excerpt, and returns `consistent | inconsistent | unclear` with a reason.

### Injection resistance

- Untrusted excerpts are passed as quoted data in a separate field, never concatenated into instructions; output is schema-constrained.
- The model can only raise risk. It can never override a hard flag or approve something the rules blocked.
- Encoded text (Morse, base64, Unicode tricks, zero-width characters) in inputs is normalized and itself raises risk.
- Every model verdict that an owner overrides becomes a labeled example for evaluation and tuning.

## Monitor pipeline

**Decision:** use Helius LaserStream gRPC for ingestion in v1, with webhooks as a simpler fallback. Running our own Geyser node waits until volume justifies it.

- LaserStream gRPC streams transactions, slots, blocks and account changes with historical replay and automatic reconnects (Helius). Most production apps use it for backends; webhooks suit servers that don't want a persistent connection (Helius docs).
- Note the cost: LaserStream needs a paid Helius plan. Budget for it from month one.

### Stages

1. **Ingest:** one gRPC subscription filtered to all watched addresses (vaults, monitored wallets, and their token accounts). Write raw events to a queue (Redpanda or NATS JetStream).
2. **Decode:** the same decoder library the firewall uses, so verdict logs and the monitor feed describe transactions identically.
3. **Enrich:** USD value (price feed), recipient reputation, whether Warden co-signed it (protected wallet) or not.
4. **Detect:** rule hits plus anomaly scores against the baseline; special detectors for settings changes on a smart account, outflows from a protected wallet not co-signed by Warden, new token approvals/delegates, and draining patterns (many outflows in a short window).
5. **Alert:** fan out to push, email, Telegram, Slack and webhooks with de-duplication and severity.
6. **Store:** append to the event store for dashboards, baselines and the Threat Network.

### Baselines

Per wallet, rolling 30 days: typical tx size distribution, active hours, known recipients and programs, daily outflow. New wallets start with conservative defaults and learn during shadow mode.

### Kill switch

Freeze = Warden stops co-signing for that wallet (instant, offchain). For monitor-only wallets the kill switch can only alert; the owner must act.

## Threat Network

The Threat Network scores four kinds of entity and gets better with every check. It is the hosted, paid core; the scoring code that consumes it can be open.

| Entity | Key | Example signals |
|---|---|---|
| Address | Solana pubkey | Age, funding source, links to known drainers, number of distinct payers, blocks and reports across customers, appearance in scam lists |
| Program | Program ID | Verified build, upgrade authority, deploy age, IDL known, usage by reputable wallets |
| x402 endpoint | Domain + path + payTo | Delivery success (HTTP 200 after payment), price history, payTo address reputation, how old the domain is |
| Content source | Domain or social handle | How often its content triggered blocked or held transactions |

### Inputs

1. **Internal:** every verdict, override and confirmed incident (anonymized across customers; raw context never shared).
2. **Onchain:** funding graphs from the monitor stream and backfills; x402 settlement transfers.
3. **Public:** community scam lists and reported drainer addresses (import with source tags and decay).
4. **Reports:** user and partner reports with reviewer confirmation.

### Scoring

v1 is a transparent weighted rule set with reasons ("funded 2 hops from a known drainer", "blocked by 3 customers this week"). Scores decay over time unless refreshed. A learned model comes later, once there are enough labeled outcomes. Every score ships with its top reasons so verdicts can be explained to owners.

## SDKs and integrations

Everything starts from one TypeScript package, `@warden/sdk`, open source (MIT). Integrations are thin wrappers around it.

### Core SDK

```ts
import { Warden } from "@warden/sdk";

const warden = new Warden({ apiKey, wallet: "<smart account>", agentSigner });

// Drop-in signer: same interface as a normal Solana signer
const signer = warden.signer({ context: () => agent.currentContext() });

const sig = await signer.sendInstructions(ixs); // checked, co-signed, submitted
```

- Wraps instructions in `executeTransactionSync`, calls `/v1/check`, adds the agent signature, submits, and returns the signature or a typed `WardenBlocked` / `WardenHeld` error with reasons.
- Held transactions can be awaited (`await signer.waitForApproval(id)`) or dropped.
- Python SDK follows in phase 2 with the same API.

### Integrations

| Target | Shape | Phase |
|---|---|---|
| Solana Agent Kit | A wallet implementation that routes every sign call through Warden, plus a plugin exposing `warden_status` and `warden_request_approval` actions | MVP |
| ElizaOS | Plugin wrapping the SDK signer; auto-tags provenance from message sources | Phase 2 |
| MCP server | `warden-mcp` exposing check, status and kill-switch tools to any MCP client | Phase 2 |
| x402 / pay.sh | Pre-pay hook: parse the 402 response, check payee and price, then pay from the spend wallet | MVP |
| Payment channels | Check on channel open and top-up | Phase 2 |

### x402 and the spend wallet

x402 clients sign a USDC transfer directly, which a smart-account vault can't do without wrapping. v1 therefore gives each protected agent a small spend wallet: a normal keypair holding a capped float (for example $50).

- Top-ups from the vault to the spend wallet go through the full firewall.
- Each x402 payment from the spend wallet runs the pre-pay hook (payee reputation, price vs. history, provenance) before signing.
- Worst case is bounded by the float. Monitor alerts on any outflow pattern.
- Revisit once x402 facilitators accept smart-account payments natively.

## API surface

REST + JSON over HTTPS, API keys scoped per workspace, and webhooks signed with HMAC. The check endpoint lives on a separate low-latency edge service.

| Method | Path | Purpose | Phase |
|---|---|---|---|
| POST | `/v1/check` | Check a transaction; returns verdict, reasons, and Warden signature on approve | MVP |
| GET | `/v1/checks/{id}` | Status of a held check (pending, approved, denied, expired) | MVP |
| POST | `/v1/checks/{id}/decision` | Owner approves or denies a held check | MVP |
| POST | `/v1/prepay` | Check an x402 payment request before paying | MVP |
| POST | `/v1/wallets` | Register a monitored wallet or create a protected smart account | MVP |
| PATCH | `/v1/wallets/{id}/policy` | Update rules, thresholds, mode (shadow / enforce) | MVP |
| POST | `/v1/wallets/{id}/freeze` | Kill switch (and `/unfreeze`) | MVP |
| GET | `/v1/wallets/{id}/events` | Decoded activity feed | MVP |
| POST | `/v1/alerts/channels` | Configure push, email, Telegram, Slack, webhook | MVP |
| GET | `/v1/reputation/{entity}` | Threat Network score with reasons | Phase 3 (public) |
| POST | `/v1/reports` | Report a scam address or endpoint | Phase 2 |

`/v1/check` response (approve):

```json
{
  "id": "chk_01J...",
  "verdict": "approve",
  "score": 12,
  "reasons": [],
  "simulated": {"vault_delta": [{"mint": "USDC", "amount": "-25.00"}]},
  "transaction": "<base64, Warden-signed>",
  "expires_at": "..."
}
```

A hold returns `id` with no transaction; a block returns reasons and a stable code (for example `RECIPIENT_DENYLISTED`, `UNTRUSTED_ORIGIN_NEW_RECIPIENT`, `CAP_EXCEEDED`).

## Data model and storage

Postgres is the system of record; ClickHouse holds the event firehose; Redis holds hot policy and reputation for the check path.

| Table / store | Key fields | Store |
|---|---|---|
| workspaces, users, api_keys | id, plan, roles, key hash, scopes | Postgres |
| wallets | id, workspace, address, type (monitor / protected), smart_account, vault, warden_key_ref, agent_signer, owner_authority, mode, frozen | Postgres |
| policies | wallet, version, rules JSON, thresholds, pre-approved routes | Postgres (+ compiled in Redis) |
| checks | id, wallet, message hash, decoded summary, stage scores, verdict, reasons, context hash, latency, signature | Postgres (90 days) + ClickHouse |
| holds | check id, expires_at, decision, decided_by | Postgres |
| events | slot, signature, wallet, decoded actions, usd value, cosigned_by_warden | ClickHouse |
| alerts | wallet, severity, type, payload, delivered_to | Postgres |
| entities | kind, key, score, reasons, sources, updated_at, decay | Postgres + Redis cache |
| baselines | wallet, window stats | Redis + Postgres snapshot |
| overrides | check id, owner action, label | Postgres (feeds tuning) |

**Privacy:** context excerpts are stored truncated (500 chars) and hashed; full context only if the workspace opts in. Threat Network sharing uses entity-level signals only, never a customer's context or task text.

## Infrastructure and deployment

The stack is boring on purpose, with a small team in mind. Speed-critical code is in Rust; everything else is TypeScript.

| Component | Tech | Notes |
|---|---|---|
| Check service | Rust (axum) | Stateless; decoder, rules, scoring in-process; 2 regions (US-East, EU) to start |
| Simulation RPC | Dedicated Solana RPC nodes (Helius or Triton), with failover | Simulation is the biggest latency cost; keep it close to the check service |
| Signing | AWS KMS (ed25519) or a key provider's API; one key per wallet | Keys never leave KMS; signing scoped by IAM to the check service only |
| Intent model | Hosted fast model via API with structured output; 1 s timeout, falls back to hold | Only on risky checks |
| Monitor workers | TypeScript on Node, consuming LaserStream into Redpanda | Horizontally scaled by wallet shard |
| API + dashboard | TypeScript (Next.js), Postgres, Redis | Dashboard is a separate app, read-mostly |
| Event store | ClickHouse | Dashboards, baselines, Threat Network jobs |
| Notifications | Push (Expo / APNs / FCM), email, Telegram bot, Slack app, webhooks | Mobile app needed for one-tap approvals |
| Infra | Fly.io or AWS ECS + Terraform; GitHub Actions CI | Move to dedicated hardware only for RPC |

**Observability:** OpenTelemetry traces per check with stage timings; dashboards for p50/p99 by stage, verdict mix, false-block rate (overrides), simulation errors; paging on check error rate above 0.5% or p99 above 400 ms.

## Securing Warden itself

Warden will be a target, so the design limits what a full compromise of Warden can do: freeze agents, never drain them.

| Threat | Impact | Control |
|---|---|---|
| Attacker gets Warden's signing access | Can co-sign, but still needs each agent's key | 2-of-2 threshold; owner can rotate Warden out; alerts on unusual co-sign volume |
| Attacker tampers with verdict logic (approves bad tx) | Bad tx needs the agent to request it too | Signed builds, two-person code review on the check service, canary rules that must block known-bad fixtures before every deploy |
| API key leak | Attacker can change policy or freeze | Policy loosening (raising caps, unfreezing, changing mode) requires owner confirmation by passkey or wallet signature |
| Malicious webhook / dashboard XSS | Fake approvals | Approvals need a signed owner action, not just a session; CSP and strict output encoding |
| Denial of service on /check | Agents stall | Per-key rate limits, regional failover, owner's recovery path |
| Supply chain (SDK) | Compromised signer in customer agents | Reproducible builds, npm provenance, minimal dependencies, pinned releases |
| Insider | Abuse of data or keys | KMS access via role only, audit trail on all key use, least privilege |

**Before launch:** external audit of the smart-account setup and check service, a public bug bounty, and a red-team exercise using real 2026 attack patterns (Morse/encoded injections, poisoned API docs, malicious MCP tool output).

## MVP build plan

Monitoring is usable by design partners in week 6; the firewall runs in shadow mode from week 10 and switches to enforce at week 14, once the audit is done. The plan assumes a small team (about two engineers plus design); adjust the weeks to the real team.

The shared decoder comes first because the monitor, the check service and the Threat Network all depend on it.

_(Build plan chart not included in pasted text.)_

## Open technical decisions

- [ ] Squads Smart Account vs. Squads V4 multisig: confirm `executeTransactionSync` availability, compute cost and account limits on mainnet for our instruction mix (Jupiter swaps are large).
- [ ] Where the agent key lives by default: local keypair (simplest) vs. Turnkey / Privy (better hygiene, adds a vendor).
- [ ] Simulation provider and whether to run our own RPC by month 3.
- [ ] Intent model choice and hosting; target cost per risky check under $0.001.
- [ ] Spend-wallet float defaults and whether x402 facilitators will accept smart-account payers.
- [ ] Whether to put Warden's own program onchain later (for example a custom guard program) or stay on Squads + Lighthouse.

## Sources

- Squads Smart Account API overview
- Squads Smart Account policies
- Squads Smart Account program (GitHub)
- `executeTransactionSync` reference (Solace)
- Lighthouse assertion program and QuickNode guide
- Helius LaserStream and data streaming overview
- Turnkey Solana policy engine
