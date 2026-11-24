import type { Metadata } from 'next'
import Link from 'next/link'
import { B, H, LegalPage, Mail, P, UL } from '@/components/hydra/Legal'

export const metadata: Metadata = { title: 'Terms of Service' }

const TOC: [string, string][] = [
  ['accept', 'Accepting these terms'], ['service', 'The service'], ['account', 'Your account'], ['funds', 'Your funds and keys'], ['verdicts', 'Verdicts are not guarantees'],
  ['use', 'Acceptable use'], ['api', 'API and SDK'], ['availability', 'Availability'], ['fees', 'Fees'], ['liability', 'Liability'], ['ending', 'Ending your use'], ['changes', 'Changes'], ['contact', 'Contact'],
]

export default function Terms() {
  return (
    <LegalPage path="/terms" title="Terms of Service" toc={TOC}
      intro={<>These terms govern your use of Warden: the website, the dashboard, the API and the SDK. Please read them, particularly the sections on verdicts and liability. Warden helps you control what your agents sign; it does not replace your own judgment.</>}>
      <H id="accept">Accepting These Terms</H>
      <P>By signing in or using the API you agree to these terms and to our <Link href="/privacy" className="text-[#c8b9ff] underline decoration-[#7c5cff] underline-offset-4">Privacy Policy</Link>. If you use Warden for an organisation, you confirm you are allowed to accept these terms on its behalf.</P>

      <H id="service">The Service</H>
      <P>Warden monitors Solana wallets you add, checks transactions your agents submit before they are signed, and returns a verdict: approve, hold for your decision, or block. Some features, such as protected smart-account wallets with Warden co-signing, are not live yet and are described as such on the site.</P>

      <H id="account">Your Account</H>
      <UL items={[
        'Your account is the wallet you sign in with. Keep that wallet secure; anyone who controls it controls your workspace.',
        'Keep API keys secret. You are responsible for activity made with your keys until you revoke them.',
        'Only add wallets you own or are authorised to monitor.',
      ]} />

      <H id="funds">Your Funds and Keys</H>
      <P><B>Warden is non-custodial.</B> We never hold your funds and never ask for a seed phrase or private key. You remain responsible for your wallets, your agents and every transaction they sign. Monitor-only wallets can be observed and alerted on, but Warden cannot stop transactions that are signed without checking with it.</P>

      <H id="verdicts">Verdicts Are Not Guarantees</H>
      <P>Warden’s verdicts are based on simulation, your policy, shared reputation data and, for some checks, an AI model. They can be wrong: a harmful transaction may be approved, or a legitimate one held or blocked. Reputation scores are signals, not statements of fact about any person. Use shadow mode to evaluate verdicts before enforcing them, and review held payments carefully.</P>

      <H id="use">Acceptable Use</H>
      <UL items={[
        'Do not use Warden to facilitate fraud, theft, sanctions evasion or other unlawful activity.',
        'Do not submit false reports to the Threat Network or try to manipulate reputation scores.',
        'Do not probe, overload or attempt to bypass the service’s security or rate limits.',
        'Do not resell access to the service without our written agreement.',
      ]} />

      <H id="api">API and SDK</H>
      <P>The SDK is open source under its own licence. API access is subject to rate limits and may change as the service develops; we will try to give notice before breaking changes.</P>

      <H id="availability">Availability</H>
      <P>We aim to keep Warden available but do not guarantee uninterrupted service. Protected wallets are designed to fail closed: if Warden is unavailable, they pause rather than sign unchecked, and your owner key can still override. Plan for this in how you run your agents.</P>

      <H id="fees">Fees</H>
      <P>Monitoring is currently free. Pricing shown on the site is early-access pricing and may change before paid features launch. We will tell you before charging for anything.</P>

      <H id="liability">Liability</H>
      <P>Warden is provided “as is”. To the extent the law allows, we are not liable for lost funds, missed trades, or indirect or consequential losses arising from your use of the service, including verdicts that turn out to be wrong, and our total liability is limited to the amount you paid us in the twelve months before the claim. Nothing in these terms limits liability that cannot be limited by law.</P>

      <H id="ending">Ending Your Use</H>
      <P>You can stop using Warden at any time and ask us to delete your workspace. We may suspend access that breaks these terms or puts the service or other customers at risk.</P>

      <H id="changes">Changes</H>
      <P>We may update these terms. If a change is significant, we will update the date at the top and tell you through the dashboard or the changelog before it takes effect.</P>

      <H id="contact">Contact</H>
      <P>Questions about these terms: <Mail />.</P>
    </LegalPage>
  )
}
