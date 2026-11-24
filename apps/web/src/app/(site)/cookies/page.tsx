import type { Metadata } from 'next'
import { B, H, LegalPage, Mail, P, Table } from '@/components/hydra/Legal'

export const metadata: Metadata = { title: 'Cookie Policy' }

const TOC: [string, string][] = [['short', 'In short'], ['cookies', 'Cookies'], ['storage', 'Browser storage'], ['third', 'Third parties'], ['control', 'Your control'], ['contact', 'Contact']]

export default function Cookies() {
  return (
    <LegalPage path="/cookies" title="Cookie Policy" toc={TOC}
      intro={<>Warden uses as little browser storage as it can. This page lists everything we set and why.</>}>
      <H id="short">In Short</H>
      <P>We use <B>one essential cookie</B> to keep you signed in, and a few small browser-storage entries that make the dashboard behave well. There are <B>no advertising, analytics or tracking cookies</B>, so there is nothing to opt out of beyond what is needed for the service to work.</P>

      <H id="cookies">Cookies</H>
      <Table head={['Name', 'Purpose', 'Type', 'Lasts']} rows={[
        ['wd_session', 'Keeps you signed in after you prove you own your wallet. Signed and HTTP-only, so page scripts cannot read it.', 'Essential', '30 days, or until you sign out'],
      ]} />

      <H id="storage">Browser Storage</H>
      <Table head={['Key', 'Purpose', 'Where', 'Lasts']} rows={[
        ['warden.wallet', 'Remembers which wallet app you signed in with, so confirmations ask the right one', 'Local storage', 'Until you clear it'],
        ['warden.cookies', 'Remembers that you dismissed the cookie notice', 'Local storage', 'Until you clear it'],
        ['warden.nav', 'Lets “Back” return you to the exact page you came from', 'Session storage', 'Until you close the tab'],
      ]} />

      <H id="third">Third Parties</H>
      <P>Warden does not load third-party trackers. Our hosting provider may keep standard request logs, described in the Privacy Policy. Wallet extensions you use, such as Phantom or Solflare, run under their own privacy policies.</P>

      <H id="control">Your Control</H>
      <P>You can delete cookies and site data from your browser settings at any time. Deleting <B>wd_session</B> signs you out; the other entries simply reset.</P>

      <H id="contact">Contact</H>
      <P>Questions: <Mail />.</P>
    </LegalPage>
  )
}
