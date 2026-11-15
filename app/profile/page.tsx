import Link from 'next/link'
import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { Stars, Empty } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { LISTING_KINDS } from '@/lib/config'
import { formatDay } from '@/lib/hours'
import { saveProfile } from '@/app/actions'

export const metadata = { title: 'My profile' }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [user, flash] = await Promise.all([requireUser(), searchParams])
  const [reviews, listings] = await Promise.all([repo.myReviews(user.id), repo.listings(user.id)])
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
            <h2 className="text-xl font-bold">🏪 {user.is_owner ? 'Your business' : 'Run a business here?'}</h2>
            <p className="my-2 text-sm">{user.is_owner ? 'Update your hours, menu, news and events.' : 'Claim your page for free and keep your hours, menu, prices and news up to date yourself.'}</p>
            <Link href="/business" className="btn w-full">{user.is_owner ? 'Open my business' : 'Claim my business'}</Link>
          </section>
        </div>
        <div className="space-y-8">
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
