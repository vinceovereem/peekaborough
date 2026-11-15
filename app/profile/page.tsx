import Link from 'next/link'
import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { Stars, CategoryTag, Empty } from '@/components/ui'
import { requireVisitor } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { LISTING_KINDS } from '@/lib/config'
import { formatDay } from '@/lib/hours'
import { saveProfile } from '@/app/actions'

export const metadata = { title: 'My profile' }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [user, flash] = await Promise.all([requireVisitor(), searchParams])
  if (!user) return (
    <Shell title="My profile">
      <section className="card mt-4 max-w-xl p-6">
        <h2 className="text-2xl font-bold">You&apos;re looking around without an account</h2>
        <p className="mt-2">That&apos;s fine — the map, what&apos;s on, the news and what the area needs are all open to read. Sign in when you want to:</p>
        <ul className="my-3 ml-5 list-disc space-y-1">
          <li>review and rate places, and save your favourites</li>
          <li>add ideas to Needs and vote on them</li>
          <li>see and post Trade listings</li>
          <li>claim and run your business page</li>
        </ul>
        <Link href="/login" className="btn">Sign in with Google</Link>
        <p className="muted mt-3 text-sm">One tap, no new password.</p>
      </section>
    </Shell>
  )
  const [favourites, reviews, listings, application] = await Promise.all([repo.myFavorites(user.id), repo.myReviews(user.id), repo.listings(user.id), repo.myApplication(user.id)])
  const mine = listings.filter(l => l.user_id === user.id)
  return (
    <Shell title="My profile" flash={flash}>
      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <form action={saveProfile} className="card grid gap-3 p-5">
            <input type="hidden" name="_from" value="/profile" />
            <div><label className="label" htmlFor="name">Name shown on your reviews and listings</label><input id="name" name="name" required maxLength={60} defaultValue={user.name} className="input" /></div>
            {user.email && <p className="muted text-sm">Signed in as {user.email}</p>}
            <div><SubmitButton>Save</SubmitButton></div>
          </form>
          <section className="card bg-sky/40 p-5">
            <h2 className="text-xl font-bold">🏪 {user.is_owner ? 'My businesses' : 'Run a business here?'}</h2>
            <p className="my-2 text-sm">{user.is_owner ? 'Update your hours, menu, news and events.' : 'Claim your page for free and keep your hours, menu, prices and news up to date yourself.'}</p>
            <Link href="/business" className="btn w-full">{user.is_owner ? 'Open My businesses' : 'Claim my business'}</Link>
          </section>
          {!user.is_admin && <section className="card bg-grass/40 p-5">
            <h2 className="text-xl font-bold">🛠️ Help run Peekaborough</h2>
            <p className="my-2 text-sm">{application?.status === 'pending' ? 'Your application to be an admin is with us.' : 'Admins check business owners, approve events and keep things friendly.'}</p>
            <Link href="/apply" className="btn btn-white w-full">{application ? 'See my application' : 'Apply to be an admin'}</Link>
          </section>}
        </div>
        <div className="space-y-8">
          <section>
            <h2 className="mb-2 text-2xl font-bold">♥ My favourites</h2>
            {favourites.length === 0 ? <Empty>No favourites yet. Open any place and tap “Add to favourites”; they also get their own filter on the <Link href="/" className="underline">map</Link>.</Empty> : (
              <ul className="grid gap-2 sm:grid-cols-2">{favourites.map(p => (
                <li key={p.id}><Link href={`/place/${p.slug}`} className="card block p-3 hover:bg-sun/30"><CategoryTag category={p.category} sub={p.subcategory} /><b className="mt-1 block truncate text-lg">{p.name}</b><span className="muted block truncate text-sm">{p.address ?? ' '}</span></Link></li>
              ))}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-2xl font-bold">⭐ My reviews</h2>
            {reviews.length === 0 ? <Empty>You haven&apos;t reviewed anywhere yet. Find a favourite on the <Link href="/" className="underline">map</Link>.</Empty> : (
              <ul className="space-y-2">{reviews.map(r => (
                <li key={r.id} className="card p-3"><Link href={`/place/${r.place?.slug}`} className="font-bold underline">{r.place?.name}</Link> <Stars rating={r.rating} /> <span className="muted text-sm">{formatDay(r.created_at)}</span>
                  {r.status === 'hidden' && <span className="tag ml-2 bg-ink/10">Hidden by a moderator</span>}{r.comment && <p className="mt-1">{r.comment}</p>}</li>
              ))}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-2xl font-bold">🔁 My listings</h2>
            {mine.length === 0 ? <Empty>Nothing listed. Got something to sell, swap or give away? <Link href="/trade" className="underline">Post it</Link>.</Empty> : (
              <ul className="space-y-2">{mine.map(l => (
                <li key={l.id} className="card flex flex-wrap items-center gap-2 p-3"><span className="tag bg-sun">{LISTING_KINDS[l.kind].emoji} {LISTING_KINDS[l.kind].label}</span><b>{l.title}</b><span className="muted text-sm">{l.status === 'closed' ? 'gone' : 'live'} · {formatDay(l.created_at)}</span><Link href="/trade" className="ml-auto text-sm font-bold underline">Manage</Link></li>
              ))}</ul>
            )}
          </section>
        </div>
      </div>
    </Shell>
  )
}
