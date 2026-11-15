import Link from 'next/link'
import LegalPage from '@/components/LegalPage'
import { APP_NAME, OPERATOR } from '@/lib/config'

export const metadata = { title: 'Security', description: `How ${APP_NAME} protects accounts and data, and how to report a problem.`, alternates: { canonical: '/security' } }

export default function Security() {
  return (
    <LegalPage title="Security" updated="15 November 2026">
      <h2>How we protect your account</h2>
      <ul>
        <li><b>No passwords to steal.</b> You sign in with Google, so {APP_NAME} never sees or stores a password.</li>
        <li><b>Encrypted connections.</b> Every page is served over HTTPS.</li>
        <li><b>Rules in the database itself.</b> Each person can change only their own reviews, listings, votes and favourites, and a business page only once an admin has verified them as its owner. These rules are enforced by the database, not just by the website.</li>
        <li><b>Private details stay private.</b> Business claims and admin applications can be read only by the person who sent them and by admins.</li>
      </ul>

      <h2>How we keep the guide trustworthy</h2>
      <ul>
        <li>Every business owner is checked by a person before they can edit a page.</li>
        <li>Events suggested by residents are approved before they appear.</li>
        <li>Admins can hide content that breaks the <Link href="/terms">terms</Link>.</li>
      </ul>

      <h2>Reporting a problem</h2>
      <p>If you find a security weakness, or see content that should not be here, please write to <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Tell us what you found and how to reproduce it, and please give us a chance to fix it before sharing it publicly. We will reply as soon as we can.</p>
    </LegalPage>
  )
}
