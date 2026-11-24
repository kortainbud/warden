# Warden

Firewall and monitor for AI agent wallets on Solana. Warden checks every transaction an agent tries to sign, blocks the ones a human never asked for, and watches every agent wallet in real time with a kill switch. It can block a transaction; it can never move funds.

Product docs: [`docs/PRD.md`](docs/PRD.md) and [`docs/ENGINEERING.md`](docs/ENGINEERING.md).

## Layout

| Path | What |
|---|---|
| `packages/decoder` | Shared transaction decoder (legacy + v0 messages, System, SPL Token/2022, ATA, Compute Budget, Memo, Jupiter, Squads, Lighthouse). Used by the check service and the monitor so both describe transactions identically. |
| `packages/engine` | Verdict engine: policies and templates, rules, Threat Network input, behaviour baseline, provenance-based intent checks, untrusted-content normalisation, scoring. Pure and tested. |
| `packages/sdk` | `@warden/sdk`, zero-dependency TypeScript client (`check`, `guard`, `prepay`, `waitForApproval`, `freeze`). |
| `apps/web` | Next.js: marketing site (`/`), docs (`/docs`), dashboard (`/app`), API (`/v1/*`), Helius webhook, cron. |

## Run

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill HELIUS_API_KEY and SESSION_SECRET
npm run dev        # real app on http://localhost:5280 (real chain data, embedded Postgres)
npm run demo       # separate demo on http://localhost:5281 (fictional fixtures, in-memory, never touches the chain)
npm test           # decoder + engine tests
npm run typecheck
```

The demo instance (`WARDEN_DEMO=1`) is for walking through every screen. The real app never loads fixtures.

## What is real today

- Wallet sign-in (Sign In With Solana), sessions, API keys.
- Monitor: any address, 30-day backfill, decoded feed, net outflow in USD, detectors (new recipient, cap breaches, amount anomaly, drain pattern, token approvals, smart account settings changes, flagged counterparties), alerts to webhook (HMAC-signed) and Slack (Telegram with a bot token). Real-time via a Helius enhanced webhook when `WARDEN_PUBLIC_URL` is set; the dashboard and a 10-minute cron catch up otherwise.
- Check service (`POST /v1/check`): decode, mainnet simulation with exact balance changes, rules, Threat Network, behaviour, provenance rules, optional intent model, shadow/enforce, holds with owner-signed approval and timeout-means-deny, kill switch.
- x402 pre-pay checks (`POST /v1/prepay`) with price-vs-history.
- Changes that weaken protection (raising caps, leaving enforce, unfreezing, approving holds, removing wallets) require an owner wallet signature, not just a session or API key.

## Not built yet

- Protected Squads smart accounts and Warden co-signing with KMS keys plus Lighthouse assertions (the engineering doc gates enforce on an external audit). `transaction` in check responses is `null` until then.
- Check service in Rust at the edge (the TypeScript engine is the reference implementation).
- Push notifications/mobile app, email alerts, fund tracing, incident reports, Python SDK, Agent Kit / ElizaOS / MCP plugins, public scam-list ingestion.
