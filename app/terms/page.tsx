import Link from 'next/link'
import LegalPage from '@/components/LegalPage'
import { APP_NAME, HOOD, OPERATOR } from '@/lib/config'

export const metadata = { title: 'Terms of use', description: `The rules for using ${APP_NAME}.`, alternates: { canonical: '/terms' } }

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="15 November 2026">
      <h2>About this site</h2>
      <p>{APP_NAME} is a free neighbourhood guide for {HOOD.name}, run by {OPERATOR.name}. You can contact us at <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. By using the site you agree to these terms.</p>

      <h2>Your account</h2>
      <p>You sign in with a Google account and are responsible for what is done with it here. You need to be 13 or over. One person, one account.</p>

      <h2>What you post</h2>
      <ul>
        <li><b>Be truthful.</b> Reviews must be your own honest experience. Do not review your own business or a competitor&apos;s, and do not post on someone else&apos;s behalf.</li>
        <li><b>Be decent.</b> Nothing unlawful, abusive, hateful, misleading or that invades someone&apos;s privacy. No spam.</li>
        <li><b>It stays yours.</b> You keep the rights to what you post, and you allow us to show it on {APP_NAME} for as long as it is on the site.</li>
        <li>Admins may hide or remove content that breaks these rules, and may close accounts that keep doing so.</li>
      </ul>

      <h2>Business pages</h2>
      <p>Only someone who genuinely represents a business may claim its page, and we check every claim. Owners are responsible for the accuracy of what they add, such as hours, prices and events.</p>

      <h2>Trading with neighbours</h2>
      <p>Listings are arrangements between the people involved. {APP_NAME} is not a party to them, takes no payment and cannot vouch for items or people. Meet somewhere public and use your judgement.</p>

      <h2>Accuracy</h2>
      <p>Place details come from public sources, such as OpenStreetMap, Transport for London and Google Maps, and from owners. Opening hours, prices, fixtures and events change, so check with the venue before you travel. The site is provided as it is, without guarantees that it is complete, correct or always available.</p>

      <h2>Our responsibility to you</h2>
      <p>We do not exclude liability where the law does not allow it. Otherwise, as this is a free service, we are not responsible for losses that arise from relying on the site or from dealings between users.</p>

      <h2>Other people&apos;s material</h2>
      <p>Map data is © OpenStreetMap contributors. Some photos come from Wikimedia Commons under their stated licences, and Google Maps content is shown under Google&apos;s terms. Please do not copy content from the site in bulk.</p>

      <h2>Changes and the law</h2>
      <p>We may update these terms and will post the new version here. They are governed by the law of England and Wales. See also our <Link href="/privacy">privacy notice</Link>.</p>
    </LegalPage>
  )
}
