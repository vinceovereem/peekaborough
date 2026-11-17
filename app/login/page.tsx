import CartoonMap from '@/components/CartoonMap'
import { Flash, Logo } from '@/components/ui'
import Footer from '@/components/Footer'
import { APP_NAME, HOOD, DEMO, TEST_ACCOUNTS, SITE_URL } from '@/lib/config'
import { DEMO_USERS } from '@/data/demo'
import { demoSignIn, googleSignIn, skipSignIn } from './actions'

const FEATURES = [
  ['🗺️', 'Every shop, café and pub', 'on a 3D map you actually want to play with'],
  ['🎟️', "What's on", 'match days, gigs, markets and parkruns in one place'],
  ['🏪', 'Mini-sites for local businesses', 'hours, menus and news, kept up to date by verified owners'],
  ['🔁', 'Trade and swap', 'with people who live round the corner'],
  ['💡', 'Say what the area needs', 'and vote — so the council and new businesses can see it'],
] as const

// This page is also what signed-out visitors (and search engines) get at the site's front door, "/".
export const metadata = { alternates: { canonical: '/' } }
const STRUCTURED = { '@context': 'https://schema.org', '@type': 'WebSite', name: APP_NAME, url: SITE_URL, description: `A free neighbourhood guide to the London Borough of ${HOOD.name}: places, events, local news and what the area needs.`, inLanguage: 'en-GB', about: { '@type': 'AdministrativeArea', name: `London Borough of ${HOOD.name}` } }

// The address only says which of these to show, never the words themselves.
const ERRORS = new Map([
  ['preview', 'Signing in is not available on this preview yet — you can still look around.'],
  ['start', 'Could not start Google sign-in'],
  ['callback', 'Sign-in did not complete, please try again'],
])

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="relative min-h-dvh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED) }} />
      <div className="fixed inset-0"><CartoonMap hero /></div>
      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center px-3 py-8 sm:px-6">
        <section className="card w-full max-w-lg p-6 sm:p-8">
          <Logo className="size-20" />
          <p className="chip bg-sun mt-3">{HOOD.name}</p>
          <h1 className="mt-3 text-4xl leading-[1.05] font-bold sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-2 text-xl font-bold">Your neighbourhood, drawn to life.</p>
          <p className="muted mt-1">A free guide to the London Borough of {HOOD.name}, made with and for the people who live here.</p>
          <ul className="mt-5 space-y-2">
            {FEATURES.map(([emoji, title, rest]) => (
              <li key={title} className="flex gap-3"><span aria-hidden className="text-xl">{emoji}</span><span><b>{title}</b> <span className="muted">{rest}</span></span></li>
            ))}
          </ul>
          <div className="mt-6"><Flash error={ERRORS.get(error ?? '')} /></div>
          <form action={googleSignIn}>
              <button className="btn btn-white w-full text-lg">
                <svg viewBox="0 0 48 48" className="size-5" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.200-5.600c-2.200 1.500-5 2.300-8.700 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z"/></svg>
                Continue with Google
              </button>
          </form>
          {/* reading needs no account; reviewing, voting, trading and running a business page do */}
          <form action={skipSignIn}><button className="mt-2 w-full py-3 font-bold underline">Skip for now — just look around</button></form>
          <p className="muted mt-2 text-xs">Sign in with Google to review, vote, trade, save favourites or run your business page — one tap, no new password. Skip and you can still look at everything, and sign in later from My profile.{DEMO && ' (Google sign-in is not connected on this preview copy.)'}</p>
          {TEST_ACCOUNTS && <details className="mt-4 rounded-xl border-2 border-dashed border-ink/30 p-3 text-sm">
            <summary className="cursor-pointer font-bold">Testing tools — this computer only, never on the live site</summary>
            <p className="muted my-2">Stand-in accounts for trying signed-in features without a database. Anything they add is temporary.</p>
            <form action={demoSignIn} className="flex flex-wrap gap-2">{DEMO_USERS.map((u, i) => <button key={u.key} name="as" value={u.key} className="btn btn-white btn-sm">{['Test resident', 'Test business owner', 'Test admin'][i]}</button>)}</form>
          </details>}
          <Footer inCard />
        </section>
      </div>
    </main>
  )
}
