# Warden — PRD: Firewall & Monitor for Agent Wallets on Solana

24 Nov 2026 · Quadri Agboluaje · Working name, status: Draft v0.1

## Summary

Warden is a firewall and monitor for AI agent wallets on Solana. It checks every transaction an agent tries to sign, blocks the ones a human never asked for, and watches every wallet in real time with a kill switch. Warden can block a transaction but can never move funds.

## The problem

Agents now hold wallets and pay on their own (x402, pay.sh, payment channels, trading agents). Nothing in that stack checks whether a payment should happen.

- **Prompt injection drains wallets.** In May 2026 a Grok-linked wallet lost about $175k to an instruction hidden in a tweet. No key was stolen and no contract was exploited (Ledger).
- **Agents get tricked into paying.** Zscaler found campaigns that hide payment scams inside API docs and search results to make agents pay (SecurityWeek).
- **Losses are already large.** Reported losses from AI agent infrastructure weaknesses passed $45M in 2026 (dev.to).
- **Trust is the adoption blocker.** Analysts name discovery, trust and compliance as the gaps holding agent payments back (MEXC).

## Why now

Solana's Request for Startups lists Security for the Agentic Age (#4): continuous transaction monitoring, onchain firewalls and stolen-fund tracing. The solana.ai ecosystem has partners for frameworks, payments, compute and identity, but no security layer. Warden fills that slot.

## Goals and non-goals

### Goals

1. Stop transactions an agent's owner never intended, including ones triggered by untrusted content, before they are signed.
2. Give owners live visibility and a one-tap kill switch for every agent wallet.
3. Build a shared threat network so each blocked attack protects every customer.
4. Fit into the Solana AI stack (Agent Kit, MCP, x402, pay.sh, payment channels) with a one-line integration.
5. Never hold the ability to move user funds.

### Non-goals (v1)

- Custody or holding user funds.
- Rebuilding basic spending limits and allowlists. Solana's Developer Platform and smart wallets already ship these; Warden uses them.
- Securing the agent's code, model or server. Warden protects the money, not the machine.
- Chains other than Solana.
- Insurance or reimbursing losses.

## Target users

The first buyers are teams running trading and payment agents with real money at risk. Distribution comes through the platforms where agents are built.

| Segment | Who | Job to be done | Priority |
|---|---|---|---|
| Trading agent builders | Indie devs and small teams running autonomous trading or treasury agents | "Let my agent trade on its own without waking up to an empty wallet." | Launch |
| Agent startups | Teams running fleets of agents that pay for APIs, data and compute | "Know what every agent is spending and stop anything weird before it lands." | Launch |
| Agent platforms and launchpads | Frameworks and launchpads (Agent Kit, ElizaOS-style, token launchpads) | "Ship protection by default so our users don't get drained." | Distribution partner |
| Funds and DAOs | Treasuries that give agents spending power | "Approval workflows and an audit trail for agent spending." | Phase 2 |
| Wallets, exchanges, facilitators | Infrastructure that wants threat data | "Flag scam addresses and malicious payment requests." | Phase 3 (data API) |

**Primary persona:** a technical founder running 1 to 20 agents with $1k to $500k in agent wallets. They need protection that adds minimal latency and takes one line of code.

## Product overview

Warden has four parts. Monitor and Firewall are what customers buy; the Threat Network is the moat; Response handles the worst day.

| Part | What it does | Plan |
|---|---|---|
| Monitor | Live feed of every agent wallet's activity, anomaly alerts, a spend dashboard, and a kill switch. Works on any address with no code. | Free and up |
| Firewall | A required co-signer. Simulates each transaction, applies rules, scores the recipient, checks intent, then approves, blocks or holds for a human. | Pro and up |
| Threat Network | Shared reputation for addresses, programs, x402 endpoints and payment requests, built from every check across all customers plus public onchain data. | Powers all tiers; sold as a data API later |
| Response | Fund tracing, exchange notification and an incident report when funds leave anyway. | Teams, or per case |

## Security model

- **The agent never holds a key that can move funds alone.** A protected wallet needs two signatures: the agent's and Warden's.
- **Warden can block, never steal.** Warden's key alone can't move funds. The owner holds a recovery key that can remove Warden at any time.
- **Fail closed, with an escape hatch.** If Warden is down, protected wallets pause; the owner can override with the recovery key.
- **Context is evidence, not instruction.** The intent check treats web pages, tweets and tool output as untrusted data, never as authority to pay.

## Key user flows

A new user gets value in under two minutes with monitoring alone, then upgrades to protection once they trust the alerts.

### 1. Start monitoring (no code)

1. Sign in with a wallet or email.
2. Paste one or more agent wallet addresses.
3. Warden backfills 30 days of history and builds a baseline of normal spending.
4. Pick alert channels: push, email, Telegram, Slack or webhook.

### 2. Upgrade to protected

1. Choose "Protect this wallet." Warden creates a smart wallet that needs the agent's signature and Warden's, with the owner's recovery key as admin.
2. Move funds into the protected wallet, or create a fresh one for the agent.
3. Add the SDK: one wrapper around the agent's signer, or the Agent Kit / ElizaOS plugin.
4. Pick a policy template (Trader, Payer, Treasury) and adjust limits.
5. Run in shadow mode for a few days: Warden scores everything and shows what it would have blocked, but blocks nothing.
6. Switch to enforce.

### 3. Transaction check

The agent builds a transaction and sends it to Warden with context. Warden returns approve, block or hold. On approve, Warden co-signs and the agent submits.

Routine transactions take the fast path and skip the intent check; only transfers, new recipients and flagged context pay for the model call.

### 4. Human approval

1. A held transaction sends a push notification with a plain-language summary: "Agent Scout wants to send 4,200 USDC to a wallet created 2 hours ago. Instruction came from a webpage."
2. The owner taps approve or deny. No answer within the timeout means deny.

### 5. Kill switch

One tap freezes a wallet or every wallet. Warden stops co-signing immediately; the owner can resume or move funds out with the recovery key.

### 6. Incident

If funds leave a monitored-only wallet or through the recovery key: an instant alert, a fund trace graph, a draft notice to the exchanges where funds landed, and a shareable incident report.

## Functional requirements

P0 ships in the MVP, P1 within the first quarter after launch, and P2 later.

| ID | Requirement | Area | Priority |
|---|---|---|---|
| M1 | Add any Solana address for monitoring with no code; backfill 30 days | Monitor | P0 |
| M2 | Real-time feed of transactions with decoded actions (transfers, swaps, x402 payments, channel opens) | Monitor | P0 |
| M3 | Alerts on rule hits and anomalies via push, email, Telegram, webhook | Monitor | P0 |
| M4 | Spend dashboard: by agent, recipient, program and day | Monitor | P1 |
| F1 | Create protected smart wallet (agent + Warden signers, owner as admin with recovery) | Firewall | P0 |
| F2 | TypeScript SDK wrapping the agent signer; Python SDK | Firewall | P0 (TS), P1 (Py) |
| F3 | Simulate every transaction and compute exact balance changes before signing | Firewall | P0 |
| F4 | Rules: per-transaction cap, daily cap, recipient allow/deny lists, allowed programs, rate limits | Firewall | P0 |
| F5 | Recipient risk score from the Threat Network | Firewall | P0 |
| F6 | Intent check: compare the transaction to the owner's request and flag instructions sourced from untrusted content | Firewall | P0 |
| F7 | Behavioral anomaly score against the wallet's baseline | Firewall | P1 |
| F8 | Verdicts approve / block / hold, with human approval by push and a timeout default of deny | Firewall | P0 |
| F9 | Shadow mode (score without blocking) | Firewall | P0 |
| F10 | x402 and pay.sh awareness: parse payment requests, check payee and price against history | Firewall | P0 |
| F11 | Payment channel checks before opening or topping up a channel | Firewall | P1 |
| F12 | Plugins for Solana Agent Kit, ElizaOS and an MCP server | Firewall | P0 (Agent Kit), P1 (others) |
| K1 | Kill switch per wallet and global | Control | P0 |
| T1 | Threat Network ingesting blocks, user reports and public scam lists | Threat | P0 |
| T2 | Public reputation API (read-only, rate-limited free tier) | Threat | P2 |
| R1 | Fund tracing graph for outgoing funds | Response | P1 |
| R2 | Incident report and exchange notice drafts | Response | P2 |
| A1 | Team workspaces, roles, approval routing, audit log export (CSV, accounting tools) | Admin | P1 |
| A2 | Policy templates: Trader, Payer, Treasury | Admin | P0 |

## Non-functional requirements

Speed decides adoption: trading agents won't accept a firewall that makes them miss fills.

| Area | Target |
|---|---|
| Fast-path latency (rules + simulation + risk score) | p50 under 80 ms, p99 under 250 ms from Warden's edge |
| Full check with intent model | p50 under 600 ms, p99 under 1.5 s; only runs on transfers, new recipients and flagged context |
| Monitor alert delay | Under 2 s from confirmation |
| Firewall availability | 99.95% monthly, multi-region |
| Signing keys | Warden's co-signer keys live in HSM or KMS-backed signers, one key per wallet, never exported |
| Fund safety | Warden's key cannot move funds alone in any configuration; verified by test suite and external audit before launch |
| Data privacy | Store transaction metadata and verdicts; store prompt or intent context only as hashes plus short excerpts unless the customer opts in |
| Auditability | Every verdict logged with inputs, rule hits and score, retained 1 year (Teams: configurable) |
| Abuse | Rate limits per key; no verdicts for wallets on sanctions lists |

## Pricing and business model

Monitoring is free to get wallets in; protection is the paid product; threat data becomes the second revenue line. All prices in USD and initial guesses to validate with the first 20 customers.

| Tier | For | Includes | Price |
|---|---|---|---|
| Free | Solo builders | Monitor 1 wallet, alerts, 7-day history | $0 |
| Pro | Indie agents, trading bots | Firewall on up to 10 wallets, intent check, shadow mode, 90-day history | $29 per protected wallet / month, includes 50k checks; then $0.002 per check |
| Teams | Agent startups, funds, DAOs | Unlimited wallets, roles, approval routing, audit export, fund tracing, SLA | From $750 / month |
| Platform | Launchpads and frameworks embedding Warden | Protection for every agent they create, revenue share | Per active wallet, volume pricing |
| Threat data API | Wallets, exchanges, x402 facilitators | Address, program and endpoint reputation | Per call or annual license |
| Incident response | Anyone drained | Trace, exchange notices, report | Per case |

Rough scale: 1,000 protected wallets at about $29 is about $29k per month. One wallet or exchange licensing threat data can match hundreds of Pro users.

## Go-to-market

Sell through the places agents are made, not wallet by wallet.

1. Open-source the SDK and rules engine. Get listed in awesome-solana-ai and the Solana AI toolkit. Keep the Threat Network and intent check hosted and paid.
2. Ship the Solana Agent Kit plugin first. One line protects any agent built on it.
3. Apply to Solana's Request for Startups (#4, Security for the Agentic Age) and the monthly agent hackathons for grants and Foundation visibility.
4. Publish a free "Agent Wallet Risk Report" on drains and injected-payment scams on Solana. It is marketing and a lead list at once.
5. Launchpad and framework partnerships. Protection on by default for every agent they create, with revenue share.
6. Hand-sell the first 20 design partners among Solana trading-agent teams; free Pro in exchange for weekly feedback and shadow-mode data.

**Positioning line:** "Solana's policies set the limits. Warden catches the attacks that stay inside them."

## Success metrics

The main metric is value protected: total USD held in wallets under Warden's Firewall. The targets are 6 months after launch and are guesses to revisit after design partners.

| Metric | Why it matters | 6-month target |
|---|---|---|
| Value protected (USD in enforced wallets) | Measures trust | $5M |
| Protected wallets | Paid usage | 1,000 |
| Monitored wallets | Top of funnel | 10,000 |
| Shadow to enforce conversion | Proves verdicts are trusted | 40% |
| False block rate (owner overrides a block) | Too high and users turn Warden off | Under 1% of checks |
| Confirmed attacks blocked | The proof point for marketing | Logged and published monthly |
| Fast-path p99 latency | Trading agents' deal-breaker | Under 250 ms |
| Platform partners live | Distribution | 3 |

## Competitive landscape

Basic limits are already free; nobody combines intent checking with shared threat data for agents on Solana. That combination is Warden's edge.

| Player | What they offer | Where Warden differs |
|---|---|---|
| Solana Developer Platform | Spending policies, compliance screening, allowlisting | Warden builds on these, adding intent checks, threat data and monitoring. Partner, not rival. |
| Virtuals Protocol | Programmable wallet policies with spending limits and kill switches at the signing layer (Crypto Briefing) | Tied to its own agent platform; Warden is neutral and works with any framework. |
| Ledger Agent Stack | Hardware-rooted security stack for AI agents (Ledger) | Hardware-first; Warden is a hosted service with live threat data. |
| Key and wallet providers (Turnkey, Privy, Squads) | Policy engines and smart wallets | Warden uses them as building blocks rather than competing. |
| Transaction simulation and scam-flagging tools | Warnings for humans in wallet popups | Built for a human reading a popup, not an agent signing at machine speed. |

**Moat:** the Threat Network compounds with every check, and the intent check's quality improves from labeled overrides. Both need scale a new entrant won't have.

## Roadmap

Monitoring ships in six weeks to start collecting data; the Firewall only goes to enforce mode after an external audit. Each phase is gated: the next phase starts only when the gate is met.

_(Roadmap diagram not included in pasted text.)_

## Risks and open questions

| Risk | Mitigation |
|---|---|
| Latency kills adoption for trading agents | Fast path without the model; intent check only on transfers, new recipients and flagged context; pre-approved recipients skip it |
| Warden becomes a high-value target | Block-only key design, HSM keys, owner recovery, external audit, bug bounty before launch |
| False blocks make users turn it off | Shadow mode first, one-tap override, every override feeds back into tuning |
| Intent check is fooled by a clever injection | It is one layer of five; simulation and recipient scoring catch the money leaving even if the model is fooled |
| Basic policies become free everywhere | Never sell limits; sell detection, data and response |
| Agent payments stay small | Firewall also covers trading and treasury agents, which already move real money |

### Open questions

- [ ] Which smart wallet base for v1: Squads, or a key provider's policy engine? (decided in the engineering doc)
- [ ] Do we need money-transmitter or other licensing for a co-signing service that cannot move funds? Get legal advice before launch.
- [ ] How much intent context will agents actually send, and in what format?
- [ ] Final name and brand.
