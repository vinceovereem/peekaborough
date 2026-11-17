import LegalPage from '@/components/LegalPage'
import { APP_NAME, HOOD, OPERATOR } from '@/lib/config'

export const metadata = { title: 'Privacy notice', description: `What ${APP_NAME} collects, why, who it is shared with and your rights.`, alternates: { canonical: '/privacy' } }

export default function Privacy() {
  const mail = <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
  return (
    <LegalPage title="Privacy notice" updated="16 November 2026">
      <h2>Who we are</h2>
      <p>{APP_NAME} is a neighbourhood guide for {HOOD.name}. For anything about your data, write to {mail}.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>When you sign in with Google:</b> your name, email address and profile picture, as Google provides them. We never see your Google password.</li>
        <li><b>What you post:</b> reviews, trade listings (including the contact line you choose to show), needs and votes, event suggestions, favourites, and the name you set on your profile.</li>
        <li><b>If you claim a business:</b> your role, a work email, a phone number if you give one, and what you tell us so we can verify you.</li>
        <li><b>If you apply to be an admin:</b> your name, email, phone number, home address, how long you have lived here, your work and your answer about the area.</li>
        <li><b>Technical records:</b> our hosting provider logs the address and browser of each request for a short time, to keep the site running and secure.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the service you asked for: showing your reviews and listings, remembering your favourites, keeping you signed in.</li>
        <li>To check that business owners and admins are who they say they are.</li>
        <li>To keep the site safe and deal with misuse.</li>
      </ul>
      <p>Our legal bases under UK data protection law are performing the service you signed up for, and our legitimate interest in running a trustworthy local guide. We do not sell your data, and we do not use it for advertising.</p>

      <h2>What other people can see</h2>
      <ul>
        <li>Your profile name appears next to your reviews, listings and needs.</li>
        <li>The contact line on a trade listing is shown to signed-in members only.</li>
        <li>Business claims and admin applications, including phone numbers and addresses, are seen only by {APP_NAME}&apos;s admins.</li>
        <li>Your email address is never shown publicly.</li>
      </ul>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in. There are no advertising or tracking cookies, so there is no cookie banner.</p>

      <h2>Who helps us run the site</h2>
      <ul>
        <li><b>Supabase</b> stores the database and handles sign-in. The data is held in the European Union (Sweden).</li>
        <li><b>Vercel</b> hosts the website and keeps the technical records mentioned above.</li>
        <li><b>Google</b> provides sign-in. Place pages may also show ratings, reviews, opening hours and photos from Google Maps; those photos and reviewer pictures load from Google&apos;s servers.</li>
        <li><b>OpenFreeMap</b> and <b>Wikimedia</b> serve the map and some photos directly to your browser, so they see your browser&apos;s address when those load.</li>
      </ul>
      <p>Some of these providers process data outside the UK. Where they do, they rely on the safeguards UK law allows, such as approved contract clauses.</p>

      <h2>How long we keep it</h2>
      <p>We keep your account and what you posted until you ask us to delete them. Admin applications that are not taken forward are deleted within twelve months. Hosting logs are kept only for a short period by our provider.</p>

      <h2>Your rights</h2>
      <p>You can ask for a copy of your data, ask us to correct or delete it, or object to how we use it. Write to {mail} and we will reply within a month. Deleting your account removes your reviews, listings, needs, votes, favourites, claims and applications.</p>
      <p>If you are unhappy with how we handle your data, you can complain to the Information Commissioner&apos;s Office at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk</a>.</p>

      <h2>Children</h2>
      <p>{APP_NAME} is not aimed at children, and you need to be 13 or over to have an account.</p>

      <h2>Changes</h2>
      <p>If we change this notice in a way that matters, we will say so on the site before the change takes effect.</p>
    </LegalPage>
  )
}
