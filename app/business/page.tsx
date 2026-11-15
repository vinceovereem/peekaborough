import Link from 'next/link'
import Shell from '@/components/Shell'
import { CategoryTag, VerifiedTag, Stars, Empty } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { formatDay } from '@/lib/hours'

export const metadata = { title: 'My businesses' }
// what an owner can change, and where on the manage page it lives
const SHORTCUTS = [['basics', 'Details & hours'], ['news', 'Post news'], ['events', 'Add an event'], ['menu', 'Menu & prices']] as const
const STATUS = { pending: ['bg-sun', '⏳ Being checked'], approved: ['bg-grass', '✓ Approved'], rejected: ['bg-tomato text-white', '✕ Not approved'] } as const

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const [user, { q = '', ...flash }] = await Promise.all([requireUser(), searchParams])
  const [places, claims, results] = await Promise.all([repo.myPlaces(user.id), repo.myClaims(user.id), repo.searchPlaces(q)])
  const claimFlow = (
    <>
        <section>
          <h2 className="mb-1 text-2xl font-bold">Find your business</h2>
          <p className="muted mb-3">Most places are already on the map. Search for yours, then tell us how to verify you.</p>
          <form className="flex max-w-xl gap-2"><input name="q" defaultValue={q} required minLength={2} className="input" placeholder="Business name" aria-label="Business name" /><button className="btn">Search</button></form>
          {q && (results.length === 0 ? <div className="mt-4"><Empty>No match for “{q}”. Not on the map yet? Email us and we&apos;ll add you.</Empty></div> : (
            <ul className="mt-4 space-y-2">{results.map(p => (
              <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="muted text-sm">{p.address ?? p.subcategory}</span></div>
                {p.verified ? <VerifiedTag /> : <Link href={`/business/claim/${p.slug}`} className="btn btn-sm">This is mine →</Link>}
              </li>
            ))}</ul>
          ))}
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[['1', 'Claim', 'Find your place and tell us your role and a work email or phone number.'], ['2', 'We check', 'A real person verifies every claim — by email, phone or popping in.'], ['3', 'You run it', 'Hours, menu and prices, news, events and photos, updated in seconds.']].map(([n, t, d]) => (
            <div key={n} className="card p-4"><span className="font-display grid size-9 place-items-center rounded-full border-2 border-ink bg-sun text-lg font-bold">{n}</span><h3 className="mt-2 text-lg font-bold">{t}</h3><p className="text-sm">{d}</p></div>
          ))}
        </section>
    </>
  )
  return (
    <Shell title="My businesses" intro={places.length ? 'Everything you run on the map. What you change here shows on your page straight away.' : "Run a shop, café, pub or service round here? Claim your page and keep it fresh — it's free."} flash={flash}>
      {places.length > 0 && <section className="mb-10">
        <ul className="grid gap-4 sm:grid-cols-2">{places.map(p => (
          <li key={p.id} className="card p-4">
            <div className="mb-1 flex flex-wrap gap-1.5"><CategoryTag category={p.category} sub={p.subcategory} /><VerifiedTag /></div>
            <h2 className="text-xl font-bold">{p.name}</h2>
            {p.address && <p className="muted text-sm">{p.address}</p>}
            <Stars rating={p.rating} count={p.review_count} />
            <div className="mt-3 flex gap-2"><Link href={`/business/${p.id}`} className="btn flex-1">✏️ Manage</Link><Link href={`/place/${p.slug}`} className="btn btn-white">View page</Link></div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">{SHORTCUTS.map(([id, label]) => <li key={id}><Link href={`/business/${p.id}#${id}`} className="underline">{label}</Link></li>)}</ul>
          </li>
        ))}</ul>
      </section>}

      {claims.length > 0 && <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold">Your claims</h2>
        <ul className="space-y-2">{claims.map(c => (
          <li key={c.id} className="card flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <span className={`tag ${STATUS[c.status][0]}`}>{STATUS[c.status][1]}</span><b>{c.place?.name}</b><span className="muted text-sm">sent {formatDay(c.created_at)}</span>
            {c.admin_note && <p className="w-full text-sm"><b>Note from the team:</b> {c.admin_note}</p>}
          </li>
        ))}</ul>
      </section>}

      {/* an owner's own pages come first; claiming another one is tucked away until they want it */}
      {places.length > 0 ? <details className="card p-4" open={!!q}>
        <summary className="font-display cursor-pointer text-xl font-bold">➕ Add another business</summary>
        <div className="mt-4">{claimFlow}</div>
      </details> : claimFlow}
    </Shell>
  )
}
