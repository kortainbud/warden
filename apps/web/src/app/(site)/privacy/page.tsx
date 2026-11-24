import type { Metadata } from 'next'
import { B, H, LegalPage, Mail, P, Table, UL } from '@/components/hydra/Legal'

export const metadata: Metadata = { title: 'Privacy Policy' }

const TOC: [string, string][] = [
  ['summary', 'In short'], ['collect', 'What we collect'], ['use', 'How we use it'], ['context', 'Agent context'], ['threat', 'Threat Network sharing'],
  ['processors', 'Who processes it'], ['retention', 'How long we keep it'], ['rights', 'Your choices'], ['security', 'Security'], ['contact', 'Contact'],
]

export default function Privacy() {
  return (
    <LegalPage path="/privacy" title="Privacy Policy" toc={TOC}
      intro={<>This policy explains what Warden collects when you use the website, the dashboard and the API, why, and what you can do about it. Warden is a firewall and monitor for AI agent wallets on Solana. It never holds your funds and never asks for a seed phrase or private key.</>}>
      <H id="summary">In Short</H>
      <UL items={[
        <>You sign in with a <B>wallet signature</B>. We store your wallet’s public address, not your name or email.</>,
        <>We store the <B>wallets you choose to monitor</B>, their public onchain activity, and the checks your agents send us.</>,
        <>Agent context is kept as <B>short excerpts and a hash</B>, never in full unless you opt in.</>,
        <>We use <B>one essential cookie</B> to keep you signed in. No advertising or analytics trackers.</>,
        <>We do <B>not sell</B> your data.</>,
      ]} />

      <H id="collect">What We Collect</H>
      <Table head={['Data', 'What it is', 'Where it comes from']} rows={[
        ['Owner address', 'The public address of the wallet you sign in with', 'Your wallet signature'],
        ['Monitored wallets', 'Addresses you add, their labels and policies', 'You'],
        ['Onchain activity', 'Decoded transactions, balances and counterparties for monitored wallets', 'Public Solana data via our RPC provider'],
        ['Checks', 'Transactions your agents submit, simulation results, verdicts, reasons and timings', 'Your agents, through the API or SDK'],
        ['Agent context', 'Task, trigger and input excerpts (500 characters max) plus a hash', 'Your agents'],
        ['Alerts and channels', 'Alert history and the webhook, Slack or Telegram destinations you configure', 'You'],
        ['API keys', 'A hash of each key, its name and last-used time. We never store the key itself', 'You'],
        ['Reports', 'Addresses you report to the Threat Network and your note', 'You'],
        ['Technical logs', 'Request logs such as IP address, user agent and timestamps, kept by our hosting provider', 'Your browser or agent'],
      ]} />

      <H id="use">How We Use It</H>
      <UL items={[
        'To run the service: monitoring wallets, checking transactions, holding payments for your approval and sending alerts.',
        'To keep it secure: verifying sign-ins and owner signatures, rate limiting, and detecting abuse.',
        'To improve verdicts: your approvals, denials and “wrong call” labels help tune scoring for your workspace.',
        'To contact you about your account or the service, if you reach out to us.',
      ]} />

      <H id="context">Agent Context</H>
      <P>Agents can send the context they were working from, such as the owner’s task, a webpage or a tweet. Warden uses it to decide whether a payment was actually requested. We store a hash of the full context and excerpts of at most 500 characters. When a check needs the intent model, the decoded transaction summary, the task and the trigger excerpt are sent to our AI provider to get a verdict. That provider does not receive your private keys or anything beyond what is needed for the check.</P>

      <H id="threat">Threat Network Sharing</H>
      <P>The Threat Network shares <B>entity-level signals only</B>: for example, that an address was blocked for several customers this week, or was confirmed as a drainer after review. Your agent’s context, tasks, policies and other customers’ wallet details are never shared with other customers.</P>

      <H id="processors">Who Processes It</H>
      <P>We use a small number of service providers to run Warden. They process data on our behalf:</P>
      <Table head={['Provider', 'Purpose']} rows={[
        ['Vercel', 'Hosting, request logs and scheduled jobs'],
        ['Neon', 'Database'],
        ['Helius', 'Solana RPC, transaction simulation and real-time activity webhooks'],
        ['Anthropic', 'Intent model for risky checks, when enabled'],
        ['Slack, Telegram, your webhooks', 'Only if you configure them as alert channels'],
      ]} />
      <P>Onchain data is public by nature. Anything already on the Solana blockchain remains public regardless of this policy.</P>

      <H id="retention">How Long We Keep It</H>
      <UL items={[
        'Check records and verdict logs: while your workspace exists, so you have an audit trail.',
        'Monitored activity: for as long as the wallet is in your workspace.',
        'Account data: until you ask us to delete it. Removing a wallet deletes its stored activity and checks.',
        'Hosting logs: according to our hosting provider’s retention.',
      ]} />

      <H id="rights">Your Choices</H>
      <UL items={[
        'Remove any monitored wallet at any time from the dashboard (this asks for your wallet signature).',
        'Revoke API keys and remove alert channels from the account menu.',
        <>Ask us for a copy of your data, or to delete your workspace, by emailing <Mail />.</>,
        'Depending on where you live, you may have further rights to access, correct or delete personal data. Email us and we will respond.',
      ]} />

      <H id="security">Security</H>
      <P>Sessions are signed and stored in an HTTP-only cookie. API keys are stored as hashes. Changes that weaken protection, such as raising a cap or approving a held payment, require a signature from your owner wallet. No method of transmission or storage is perfectly secure, but we design Warden so that even a full compromise of the service could freeze your agents and never move your funds.</P>

      <H id="contact">Contact</H>
      <P>Questions about this policy or your data: <Mail />. If we change this policy in a meaningful way, we will update the date at the top and note it in the changelog.</P>
    </LegalPage>
  )
}
